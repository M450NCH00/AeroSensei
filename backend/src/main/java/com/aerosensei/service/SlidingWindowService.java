package com.aerosensei.service;

import com.aerosensei.repository.SensorRegistryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

import com.aerosensei.dto.DataRecordDTO;

@Service
public class SlidingWindowService {

    @Autowired
    private SensorRegistryRepository sensorRegistryRepository;

    // --- NEW CONFIGURATION FIELDS ---
    @Value("${agent.api.url}")
    private String agentApiUrl;

    @Value("${agent.api.secret}")
    private String internalApiSecret;

    private final RestTemplate restTemplate = new RestTemplate();

    // The Cooldown Cache: Maps a Site ID to the exact time an alert was last sent
    private final Map<String, Instant> lastAlertTimeMap = new ConcurrentHashMap<>();

    private static final Logger logs = LoggerFactory.getLogger(SlidingWindowService.class);

    private final InfluxDBService influxDBService;

    // The In-Memory Store: Maps a Site ID to a Queue of recent readings
    private final Map<Integer, ConcurrentLinkedDeque<DataRecordDTO.SensorReading>> siteQueues = new ConcurrentHashMap<>();

    // Inject the async service
    public SlidingWindowService(InfluxDBService influxDBService) {
        this.influxDBService = influxDBService;
    }

    public void processIncomingReading(DataRecordDTO.SensorPayLoad payload) throws Exception {
        int siteId = sensorRegistryRepository.findSiteIdBySensorId(payload.sensorId());
        Instant now = Instant.now();
        Instant cutoffTime = now.minus(1, ChronoUnit.MINUTES);

        // 1. Get or create the queue for this specific site
        ConcurrentLinkedDeque<DataRecordDTO.SensorReading> queue = siteQueues.computeIfAbsent(
                siteId,
                k -> new ConcurrentLinkedDeque<>()
        );

        // 2. Add the new reading to the end of the queue
        queue.addLast(new DataRecordDTO.SensorReading(payload.pm2_5(), payload.pm10(), payload.timestamp()));

        // 3. Evict old data (anything older than 15 minutes)
        // removeIf is thread-safe for concurrent collections and highly efficient
        queue.removeIf(reading -> reading.timestamp().isBefore(cutoffTime));

        // 4. Calculate the new average for the site
        double sumPm25 = 0;
        double sumPm10 = 0;
        int count = 0;

        for (DataRecordDTO.SensorReading reading : queue) {
            sumPm25 += reading.pm2_5().doubleValue();
            sumPm10 += reading.pm10().doubleValue();
            count++;
        }

        double avgPm25 = count > 0 ? sumPm25 / count : 0;
        double avgPm10 = count > 0 ? sumPm10 / count : 0;

        logs.info("Site {} - Active Readings in Queue: {} | 15m Avg PM2.5: {} | 15m Avg PM10: {}", siteId, count, avgPm25, avgPm10);

        // 5. Evaluate Threshold & Trigger Agent API (Logic goes here)
        checkThresholdsAndAlert(siteId, avgPm25, avgPm10);

        // 6. Asynchronously fire off the raw data to InfluxDB for permanent storage and change the sensor id in to uuid
        influxDBService.saveRawDataAsync(payload);
    }

//    // =========================================================
//    // THE 5-MINUTE SYNC JOB
//    // =========================================================
//    @Scheduled(fixedRate = 300000) // Runs every 300,000 ms (5 minutes)
//    public void syncAveragesToPostgres() {
//        logs.info("Starting 5-minute background sync of PM averages to PostgreSQL...");
//        Instant cutoffTime = Instant.now().minus(1, ChronoUnit.MINUTES);
//
//        // Iterate through all active sites in memory
//        for (Map.Entry<Integer, ConcurrentLinkedDeque<DataRecordDTO.SensorReading>> entry : siteQueues.entrySet()) {
//            int siteId = entry.getKey();
//            ConcurrentLinkedDeque<DataRecordDTO.SensorReading> queue = entry.getValue();
//
//            // 1. Evict stale data first (vital if a sensor goes offline!)
//            queue.removeIf(reading -> reading.timestamp().isBefore(cutoffTime));
//
//            // 2. Calculate the current average
//            double sumPm25 = 0;
//            double sumPm10 = 0;
//            int count = 0;
//
//            for (DataRecordDTO.SensorReading reading : queue) {
//                sumPm25 += reading.pm2_5().doubleValue();
//                sumPm10 += reading.pm10().doubleValue();
//                count++;
//            }
//
//            double avgPm25 = count > 0 ? sumPm25 / count : 0;
//            double avgPm10 = count > 0 ? sumPm10 / count : 0;
//
//            // 3. Save directly to the company_sites table
//            companySiteRepository.updateSiteAverages(siteId, avgPm25, avgPm10);
//
//            logs.info("Synced Site {} to DB -> Avg PM2.5: {}, Avg PM10: {}", siteId, avgPm25, avgPm10);
//        }
//    }

    private void checkThresholdsAndAlert(int siteId, double avgPm25, double avgPm10) {
        double thresholdPm25 = 55.0;
        double thresholdPm10 = 120.0;

        // 1. Evaluate PM2.5 independently
        if (avgPm25 > thresholdPm25) {
            processSpecificAlert(siteId, avgPm25, thresholdPm25, "pm2.5");
        }

        // 2. Evaluate PM10 independently
        // If both are exceeded, this will simply run back-to-back and fire two requests!
        if (avgPm10 > thresholdPm10) {
            processSpecificAlert(siteId, avgPm10, thresholdPm10, "pm10");
        }
    }

    private void processSpecificAlert(int siteId, double measuredValue, double threshold, String pmType) {
        // Create a unique key for this site AND this specific pollutant (e.g., "5_pm2.5")
        String cacheKey = siteId + "_" + pmType;

        Instant now = Instant.now();
        Instant lastAlertTime = lastAlertTimeMap.get(cacheKey);

        // COOLDOWN CHECK: Has it been at least 1 minute since the last alert for THIS specific pollutant?
        if (lastAlertTime == null || ChronoUnit.MINUTES.between(lastAlertTime, now) >= 1) {

            try {
                // Send the HTTP request
                sendPostRequestToAgent(siteId, measuredValue, threshold, pmType);

                // Update the cooldown timer so THIS specific pollutant won't fire again for a minute
                lastAlertTimeMap.put(cacheKey, now);

                // TODO (Optional): Insert record into pm_alerts PostgreSQL table here

            } catch (Exception e) {
                logs.error("Failed to send {} alert to Agent API for site {}: {}", pmType, siteId, e.getMessage());
            }
        } else {
            logs.debug("Site {} ({}) is above {}, but alert is suppressed by 1-minute cooldown.", siteId, pmType, threshold);
        }
    }

    private void sendPostRequestToAgent(int siteId, double measuredValue, double threshold, String pmType) {
        // 1. Setup the HTTP Headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Internal-Secret", internalApiSecret);

        // 2. Build the Payload Object
        AgentAlertPayload payload = new AgentAlertPayload(
                "SITE-" + siteId,
                pmType,
                Math.round(measuredValue * 100.0) / 100.0, // Rounds to 2 decimal places
                threshold,
                "critical"
        );

        // 3. Wrap and Send
        HttpEntity<AgentAlertPayload> requestEntity = new HttpEntity<>(payload, headers);

        // This makes the synchronous POST request to your Python agent
        restTemplate.postForObject(agentApiUrl, requestEntity, String.class);

        logs.info("CRITICAL ALERT DISPATCHED: Site {} recorded {} of {}", siteId, pmType.toUpperCase(), measuredValue);
    }

    // A simple record to automatically format the JSON payload for the Python agent
    public record AgentAlertPayload(
            String sensor_id,
            String pm_type,
            double measured_value,
            double threshold_value,
            String alert_level
    ) {}
}