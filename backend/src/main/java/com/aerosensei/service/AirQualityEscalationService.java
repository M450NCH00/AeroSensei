package com.aerosensei.service;

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

import com.aerosensei.dto.SiteSensor15MinDTO;
import com.aerosensei.enums.SiteState;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * City-wide air-quality escalation. Periodically classifies every live sensor
 * (via {@link SensorService#getSystemSensorStateCounts()}) and, when the share
 * of unhealthy sensors crosses a threshold, hands off to the AI agent's
 * {@code /ministry-alert} endpoint, which emails tailored directives to the
 * relevant ministries (Education, Health, Transport, ...).
 *
 * Two escalation levels, worst-first:
 *   BREACHED  — >= breachedFraction of live sensors are in BREACHED state
 *               (e.g. schools cancel classes, industry cuts output).
 *   WARNING   — >= warningFraction of live sensors are WARNING-or-worse
 *               (e.g. schools ban outdoor activities, health advisory issued).
 *
 * A cooldown prevents re-emailing every cycle while an episode persists, but an
 * escalation from WARNING to BREACHED always fires immediately. When conditions
 * fall back below the warning threshold, the state resets so the next episode
 * re-alerts.
 */
@Service
public class AirQualityEscalationService {

    private static final Logger log = LoggerFactory.getLogger(AirQualityEscalationService.class);

    @Autowired
    private SensorService sensorService;

    @Autowired
    private com.aerosensei.repository.SensorRegistryRepository registryRepository;

    @Value("${escalation.enabled:true}")
    private boolean enabled;

    // Fraction of live sensors that must be WARNING-or-worse / BREACHED to escalate.
    @Value("${escalation.warning-fraction:0.5}")
    private double warningFraction;

    @Value("${escalation.breached-fraction:0.5}")
    private double breachedFraction;

    // Don't re-send the same level more often than this (minutes).
    @Value("${escalation.cooldown-minutes:360}")
    private long cooldownMinutes;

    @Value("${agent.ministry.url:http://ai-agent:5001/ministry-alert}")
    private String agentMinistryUrl;

    @Value("${agent.site.url:http://ai-agent:5001/site-alert}")
    private String agentSiteUrl;

    @Value("${agent.site.clear.url:http://ai-agent:5001/site-alerts/clear}")
    private String agentSiteClearUrl;

    // Reuses the shared internal secret used for the other agent hand-offs.
    @Value("${agent.api.secret:}")
    private String internalApiSecret;

    private final RestTemplate restTemplate = new RestTemplate();

    // Last level we emailed about ("NONE" | "WARNING" | "BREACHED") and when.
    private volatile String lastNotifiedLevel = "NONE";
    private volatile Instant lastNotifiedAt = Instant.EPOCH;

    // Per-site dedup: the last level we told the agent about, keyed by site id.
    // Prevents re-pushing a site alert every cycle while a site stays unhealthy.
    private final Map<Integer, String> lastSiteLevel = new ConcurrentHashMap<>();

    /**
     * Runs on a fixed schedule (default every 15 minutes). Override with
     * {@code escalation.check.rate-ms}.
     */
    @Scheduled(fixedRateString = "${escalation.check.rate-ms:900000}")
    public void checkAndEscalate() {
        if (!enabled) return;

        // All sites with a current 15-min state; keep only online ones (with data).
        List<SiteSensor15MinDTO> liveSites = sensorService.getAllSiteStates().stream()
                .filter(s -> s.getAvgPm25() != null || s.getAvgPm10() != null)
                .collect(Collectors.toList());

        // 1) Per-site company alerts (deduped across cycles).
        syncSiteAlerts(liveSites);

        // 2) City-wide department escalation — based on the share of SITES.
        int total = liveSites.size();
        if (total == 0) {
            log.debug("Escalation check: no live sites; skipping city-wide.");
            return;
        }
        int warnings = 0, breaches = 0;
        for (SiteSensor15MinDTO s : liveSites) {
            if (s.getState() == SiteState.BREACHED) breaches++;
            else if (s.getState() == SiteState.WARNING) warnings++;
        }

        double breachedShare = (double) breaches / total;
        double warningShare = (double) (warnings + breaches) / total; // WARNING-or-worse

        String level;
        if (breachedShare >= breachedFraction) {
            level = "BREACHED";
        } else if (warningShare >= warningFraction) {
            level = "WARNING";
        } else {
            level = "NONE";
        }

        if ("NONE".equals(level)) {
            if (!"NONE".equals(lastNotifiedLevel)) {
                log.info("City-wide air quality recovered below warning threshold; resetting escalation state.");
                lastNotifiedLevel = "NONE";
            }
            return;
        }

        if (!shouldNotify(level)) {
            log.debug("Escalation {} suppressed (cooldown; last sent {} at {}).",
                    level, lastNotifiedLevel, lastNotifiedAt);
            return;
        }

        boolean sent = sendMinistryAlert(level, total, warnings, breaches, warningShare, breachedShare);
        if (sent) {
            lastNotifiedLevel = level;
            lastNotifiedAt = Instant.now();
        }
    }

    /**
     * Force a ministry escalation for an explicit level, bypassing the schedule,
     * thresholds, and cooldown. Used by the demo controls: when an operator forces
     * all sensors to WARNING/BREACHED, we already know the city-wide state, so we
     * email the ministries immediately rather than waiting for the next scheduled
     * sweep. Stats reflect all registered sensors at the forced level.
     */
    public void forceEscalation(String level) {
        level = level.toUpperCase();
        if (!"WARNING".equals(level) && !"BREACHED".equals(level)) return;

        // Per-site: immediately raise a company alert for every site at the forced
        // level, so the demo shows site alerts without waiting for the next sweep.
        try {
            for (SiteSensor15MinDTO s : sensorService.getAllSiteStates()) {
                sendSiteAlert(s, level);
                lastSiteLevel.put(s.getSiteId(), level);
            }
        } catch (Exception e) {
            log.error("forceEscalation: site-alert push failed: {}", e.getMessage());
        }

        int total = (int) registryRepository.count();
        boolean breached = "BREACHED".equals(level);
        int breaches = breached ? total : 0;
        int warnings = breached ? 0 : total;
        double breachedShare = breached ? 1.0 : 0.0;

        if (sendMinistryAlert(level, total, warnings, breaches, 1.0, breachedShare)) {
            lastNotifiedLevel = level;
            lastNotifiedAt = Instant.now();
        }
    }

    /** Reset dedup state (e.g. when the demo is reset to normal) so the next episode re-alerts. */
    public void resetState() {
        lastNotifiedLevel = "NONE";
        lastSiteLevel.clear();
        // Tell the agent to drop all per-site alerts so the Alerts page clears.
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Internal-Secret", internalApiSecret);
            restTemplate.postForObject(agentSiteClearUrl, new HttpEntity<>(headers), String.class);
        } catch (Exception e) {
            log.error("Failed to clear site alerts on reset: {}", e.getMessage());
        }
    }

    /**
     * Push a /site-alert to the agent only when a site's level changes (first
     * detection, WARNING&lt;-&gt;BREACHED, or recovery to SAFE). Sites that go offline
     * have any prior alert cleared.
     */
    private void syncSiteAlerts(List<SiteSensor15MinDTO> liveSites) {
        Set<Integer> seen = new HashSet<>();
        for (SiteSensor15MinDTO s : liveSites) {
            seen.add(s.getSiteId());
            String level = s.getState() == SiteState.BREACHED ? "BREACHED"
                    : s.getState() == SiteState.WARNING ? "WARNING" : "SAFE";
            String prev = lastSiteLevel.get(s.getSiteId());
            if (level.equals(prev)) continue; // no change since last cycle

            if ("SAFE".equals(level)) {
                if (prev != null && !"SAFE".equals(prev)) {
                    sendSiteAlert(s, "SAFE"); // recovered -> clear
                }
            } else {
                sendSiteAlert(s, level);
            }
            lastSiteLevel.put(s.getSiteId(), level);
        }
        // Sites that dropped offline this cycle: clear any lingering alert.
        for (Map.Entry<Integer, String> e : lastSiteLevel.entrySet()) {
            if (!seen.contains(e.getKey()) && !"SAFE".equals(e.getValue())) {
                sendSiteAlertRaw(e.getKey(), null, null, "SAFE", null, null);
                e.setValue("SAFE");
            }
        }
    }

    private void sendSiteAlert(SiteSensor15MinDTO site, String level) {
        sendSiteAlertRaw(site.getSiteId(), site.getSiteName(), site.getCompanyName(),
                level, site.getAvgPm25(), site.getAvgPm10());
    }

    private void sendSiteAlertRaw(Integer siteId, String siteName, String companyName,
                                  String level, Double pm25, Double pm10) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Internal-Secret", internalApiSecret);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("site_id", siteId);
            body.put("site_name", siteName);
            body.put("company_name", companyName);
            body.put("level", level);
            body.put("pm2_5", pm25);
            body.put("pm10", pm10);

            restTemplate.postForObject(agentSiteUrl, new HttpEntity<>(body, headers), String.class);
        } catch (Exception e) {
            log.error("Failed to dispatch site alert (site {}, {}): {}", siteId, level, e.getMessage());
        }
    }

    /** Fire on first detection, on escalation (WARNING -> BREACHED), or after the cooldown. */
    private boolean shouldNotify(String level) {
        if (!level.equals(lastNotifiedLevel)) return true; // new level or escalation
        return ChronoUnit.MINUTES.between(lastNotifiedAt, Instant.now()) >= cooldownMinutes;
    }

    private boolean sendMinistryAlert(String level, int total, int warnings, int breaches,
                                      double warningShare, double breachedShare) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Internal-Secret", internalApiSecret);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("level", level);
            body.put("total_sensors", total);
            body.put("warning_sensors", warnings);
            body.put("breached_sensors", breaches);
            body.put("warning_pct", Math.round(warningShare * 1000.0) / 10.0);   // 1 dp
            body.put("breached_pct", Math.round(breachedShare * 1000.0) / 10.0);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            String response = restTemplate.postForObject(agentMinistryUrl, request, String.class);
            log.warn("MINISTRY ESCALATION [{}] dispatched: {}/{} sensors breached, {}/{} warning. Agent: {}",
                    level, breaches, total, warnings, total, response);
            return true;
        } catch (Exception e) {
            log.error("Failed to dispatch ministry escalation to agent: {}", e.getMessage());
            return false;
        }
    }
}
