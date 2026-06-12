package com.aerosensei.dto;

import java.time.Instant;

public class SensorReadingDTO {
    private String sensorId;
    private String siteName;
    private Double readingValue;
    private Instant timestamp;

    public SensorReadingDTO(String sensorId, String siteName, Double readingValue, Instant timestamp) {
        this.sensorId = sensorId;
        this.siteName = siteName;
        this.readingValue = readingValue;
        this.timestamp = timestamp;
    }

    // Getters
    public String getSensorId() { return sensorId; }
    public String getSiteName() { return siteName; }
    public Double getReadingValue() { return readingValue; }
    public Instant getTimestamp() { return timestamp; }
}