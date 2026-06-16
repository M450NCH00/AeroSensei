package com.aerosensei.dto;

import java.math.BigDecimal;

public class SensorInfoDTO {
    private String sensorId;
    private String locationName;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String status;

    public SensorInfoDTO(String sensorId, String locationName, BigDecimal latitude, BigDecimal longitude, String status) {
        this.sensorId = sensorId;
        this.locationName = locationName;
        this.latitude = latitude;
        this.longitude = longitude;
        this.status = status;
    }

    // Getters
    public String getSensorId() { return sensorId; }
    public String getLocationName() { return locationName; }
    public BigDecimal getLatitude() { return latitude; }
    public BigDecimal getLongitude() { return longitude; }
    public String getStatus() { return status; }
}