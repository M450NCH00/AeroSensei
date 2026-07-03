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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

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

    // Reuses the shared internal secret used for the other agent hand-offs.
    @Value("${agent.api.secret:}")
    private String internalApiSecret;

    private final RestTemplate restTemplate = new RestTemplate();

    // Last level we emailed about ("NONE" | "WARNING" | "BREACHED") and when.
    private volatile String lastNotifiedLevel = "NONE";
    private volatile Instant lastNotifiedAt = Instant.EPOCH;

    /**
     * Runs on a fixed schedule (default every 15 minutes). Override with
     * {@code escalation.check.rate-ms}.
     */
    @Scheduled(fixedRateString = "${escalation.check.rate-ms:900000}")
    public void checkAndEscalate() {
        if (!enabled) return;

        int[] counts = sensorService.getSystemSensorStateCounts();
        int total = counts[0], warnings = counts[1], breaches = counts[2];
        if (total == 0) {
            log.debug("Escalation check: no live sensors; skipping.");
            return;
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
