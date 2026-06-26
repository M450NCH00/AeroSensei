package com.aerosensei.service;

import com.aerosensei.entity.CompanySite;
import com.aerosensei.entity.PmAlert;
import com.aerosensei.repository.CompanySiteRepository;
import com.aerosensei.repository.PmAlertRepository;
import com.aerosensei.repository.SensorRegistryRepository;
import com.influxdb.client.InfluxDBClient;
import com.influxdb.query.FluxRecord;
import com.influxdb.query.FluxTable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Nightly enforcement sweep: for every company site, average the last 24 hours
 * of its sensors' PM2.5 and PM10 readings and compare each against Vietnam's
 * QCVN 05:2023/BTNMT 24-hour ambient limits. When a site's average lands in the
 * warning band (80-100% of the limit) or breaches it (>100%), a row is written
 * to {@code pm_alerts} so it surfaces on the government enforcement / fines view.
 *
 * Enforcement is site-scoped (a site may host several sensors), matching the
 * pm_alerts schema (site_id, not sensor_id).
 */
@Service
public class PmAlertSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(PmAlertSchedulerService.class);

    @Autowired
    private InfluxDBClient influxDBClient;

    @Autowired
    private SensorRegistryRepository registryRepository;

    @Autowired
    private CompanySiteRepository companySiteRepository;

    @Autowired
    private PmAlertRepository pmAlertRepository;

    @Value("${influxdb.org}")
    private String org;

    @Value("${influxdb.bucket}")
    private String bucket;

    // QCVN 05:2023/BTNMT 24-hour ambient air quality limits (µg/m³). PM2.5 steps
    // down to 45 effective 1 Jan 2026 — the value in force for the platform's
    // current period. Overridable via application properties.
    @Value("${pm.alert.threshold.pm25:45}")
    private double pm25Threshold;

    @Value("${pm.alert.threshold.pm10:100}")
    private double pm10Threshold;

    // Fraction of the limit at which a reading becomes a WARNING (default 80%).
    @Value("${pm.alert.warning-fraction:0.8}")
    private double warningFraction;

    // --- Autonomous enforcement hand-off ---
    // After the sweep, optionally ask the AI agent to auto-issue fines for every
    // BREACHED, un-fined alert. Off by default — auto-fining is consequential.
    @Value("${agent.enforce.enabled:false}")
    private boolean autoFineEnabled;

    @Value("${agent.enforce.url:http://ai-agent:5001/enforce}")
    private String agentEnforceUrl;

    // Shared internal secret (same one used for the /alert hand-off).
    @Value("${agent.api.secret:}")
    private String internalApiSecret;

    private final RestTemplate restTemplate = new RestTemplate();

    // Vietnam local day — the calendar day a breach/warning is recorded "for".
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /**
     * Runs every night at midnight (Vietnam time). Override the schedule with the
     * {@code pm.alert.cron} property (Spring 6-field cron expression).
     */
    @Scheduled(cron = "${pm.alert.cron:0 0 0 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void runNightlyPmCheck() {
        evaluateNow();
        // Hand off to the AI agent to autonomously fine the breaches (if enabled).
        if (autoFineEnabled) {
            triggerAgentAutoFine();
        }
    }

    /**
     * Run the PM breach/warning evaluation across all sites right now and return how
     * many {@code pm_alerts} rows were written. Shared by the nightly job and the
     * on-demand "evaluate now" endpoint (used to demo enforcement without waiting
     * for midnight).
     */
    public int evaluateNow() {
        log.info("=== PM breach check starting (PM2.5 limit {} / PM10 limit {} µg/m³) ===",
                pm25Threshold, pm10Threshold);

        List<CompanySite> sites = companySiteRepository.findAll();
        int alertsWritten = 0;
        for (CompanySite site : sites) {
            try {
                alertsWritten += evaluateSite(site);
            } catch (Exception e) {
                // One bad site shouldn't abort the whole sweep.
                log.error("PM check failed for site {} ({})", site.getId(), site.getSiteName(), e);
            }
        }
        log.info("=== PM breach check finished: {} site(s) scanned, {} alert(s) written ===",
                sites.size(), alertsWritten);
        return alertsWritten;
    }

    /**
     * Ask the AI agent to auto-issue fines for every BREACHED, un-fined alert.
     * Fire-and-forget over the internal channel: a failure here must never break
     * the nightly sweep, and the agent itself re-checks role and skips alerts that
     * are already fined.
     */
    private void triggerAgentAutoFine() {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Internal-Secret", internalApiSecret);
            HttpEntity<String> request = new HttpEntity<>("{}", headers);
            String response = restTemplate.postForObject(agentEnforceUrl, request, String.class);
            log.info("Auto-fine enforcement triggered: {}", response);
        } catch (Exception e) {
            log.error("Failed to trigger agent auto-fine enforcement: {}", e.getMessage());
        }
    }

    /** Averages a single site's last-24h PM readings and records any breaches. */
    private int evaluateSite(CompanySite site) {
        Long siteId = site.getId();

        // The InfluxDB sensor_id tag is the sensor's registry UUID, not its code.
        List<String> sensorUuids = registryRepository.findSensorUuidsBySiteId(siteId.intValue());
        if (sensorUuids == null || sensorUuids.isEmpty()) {
            log.debug("Site {} has no sensors; skipping.", siteId);
            return 0;
        }

        String uuidFilter = sensorUuids.stream()
                .map(uuid -> "r.sensor_id == \"" + uuid + "\"")
                .collect(Collectors.joining(" or "));

        // 24-hour mean per field, pooling every sensor at the site into one value.
        String flux = String.format(
                "from(bucket:\"%s\") " +
                        "|> range(start: -24h) " +
                        "|> filter(fn: (r) => r._measurement == \"air_quality\") " +
                        "|> filter(fn: (r) => %s) " +
                        "|> filter(fn: (r) => r._field == \"pm2_5\" or r._field == \"pm10\") " +
                        "|> group(columns: [\"_field\"]) " +
                        "|> mean()",
                bucket, uuidFilter
        );

        Double avgPm25 = null;
        Double avgPm10 = null;
        List<FluxTable> tables = influxDBClient.getQueryApi().query(flux, org);
        for (FluxTable table : tables) {
            for (FluxRecord record : table.getRecords()) {
                Object value = record.getValue();
                if (!(value instanceof Number)) continue;
                double v = ((Number) value).doubleValue();
                if ("pm2_5".equals(record.getField())) {
                    avgPm25 = v;
                } else if ("pm10".equals(record.getField())) {
                    avgPm10 = v;
                }
            }
        }

        if (avgPm25 == null && avgPm10 == null) {
            log.debug("Site {} reported no PM data in the last 24h; skipping.", siteId);
            return 0;
        }

        int written = 0;
        written += maybeRecordAlert(siteId, "pm2.5", avgPm25, pm25Threshold);
        written += maybeRecordAlert(siteId, "pm10", avgPm10, pm10Threshold);
        return written;
    }

    /**
     * Writes a pm_alerts row when {@code measured} is in the warning band or over
     * the limit. Returns 1 if a row was written, 0 otherwise.
     */
    private int maybeRecordAlert(Long siteId, String pmType, Double measured, double threshold) {
        if (measured == null) return 0;

        double ratio = measured / threshold;
        String level;
        if (ratio >= 1.0) {
            level = "BREACHED";          // over the national limit
        } else if (ratio >= warningFraction) {
            level = "WARNING";           // 80-100% of the limit
        } else {
            return 0;                    // below the warning band — nothing to record
        }

        PmAlert alert = new PmAlert();
        alert.setSiteId(siteId);
        alert.setPmType(pmType);
        alert.setMeasuredValue(BigDecimal.valueOf(measured).setScale(2, RoundingMode.HALF_UP));
        alert.setThresholdValue(BigDecimal.valueOf(threshold).setScale(2, RoundingMode.HALF_UP));
        alert.setAlertLevel(level);
        alert.setAlertDate(LocalDate.now(VN_ZONE));  // which day this breach/warning is for
        alert.setNote(String.format(
                "Nightly 24h average %s = %.2f µg/m³ (%.0f%% of QCVN 05:2023 limit %.0f µg/m³).",
                pmType, measured, ratio * 100.0, threshold));
        pmAlertRepository.save(alert);

        log.info("Site {} {} {}: {} µg/m³ vs limit {} ({}%).",
                siteId, pmType, level, alert.getMeasuredValue(), threshold, Math.round(ratio * 100.0));
        return 1;
    }
}
