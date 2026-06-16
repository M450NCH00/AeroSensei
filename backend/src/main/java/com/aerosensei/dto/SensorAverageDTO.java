package com.aerosensei.dto;

import java.io.Serializable;
import java.time.Instant;

public class SensorAverageDTO implements Serializable {
    private String sensorId;
    private String locationName;
    private Double pm25;
    private Double pm10;
    private Instant lastCalculated;

    // Default Constructor for Redis
    public SensorAverageDTO() {}

    // Getters and Setters
    public String getSensorId() { return sensorId; }
    public void setSensorId(String sensorId) { this.sensorId = sensorId; }

    public String getLocationName() { return locationName; }
    public void setLocationName(String locationName) { this.locationName = locationName; }

    public Double getPm25() { return pm25; }
    public void setPm25(Double pm25) { this.pm25 = pm25; }

    public Double getPm10() { return pm10; }
    public void setPm10(Double pm10) { this.pm10 = pm10; }

    public Instant getLastCalculated() { return lastCalculated; }
    public void setLastCalculated(Instant lastCalculated) { this.lastCalculated = lastCalculated; }
}