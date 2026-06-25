package com.aerosensei.service;

import com.aerosensei.repository.SensorRegistryRepository;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SensorIdTranslationService {

    private static final Logger logs = LoggerFactory.getLogger(SensorIdTranslationService.class);

    private final SensorRegistryRepository sensorRegistryRepository;

    // The In-Memory Cache: Maps "esp32_015" -> "123e4567-e89b-..." (as a String)
    private final Map<String, String> uuidCache = new ConcurrentHashMap<>();

    // Inject the JPA Repository
    public SensorIdTranslationService(SensorRegistryRepository sensorRegistryRepository) {
        this.sensorRegistryRepository = sensorRegistryRepository;
    }

    public String getUuidFromLabel(String deviceLabel) {
        // computeIfAbsent checks the memory map first.
        // If it's missing, it runs the database query block.
        return uuidCache.computeIfAbsent(deviceLabel, this::fetchUuidFromDatabase);
    }

    private String fetchUuidFromDatabase(String deviceLabel) {
        logs.info("Cache miss. Fetching UUID from PostgreSQL for device: {}", deviceLabel);

        // Call your repository method.
        // Using orElseThrow prevents bad data from getting into your cache or InfluxDB.
        return sensorRegistryRepository.findSensorIdByDeviceLabel(deviceLabel)
                .orElseThrow(() -> {
                    logs.error("URGENT: Unregistered sensor attempted to send data: {}", deviceLabel);
                    return new IllegalArgumentException("Unknown sensor device label: " + deviceLabel);
                });
    }
}