package com.aerosensei.dto;

import java.math.BigDecimal;

public class SensorRegistrationDTO {
    private String sensorId;
    private String locationName;
    private BigDecimal latitude;
    private BigDecimal longitude;

    // Default Constructor
    public SensorRegistrationDTO() {}

    // Getters and Setters
    public String getSensorId() { return sensorId; }
    public void setSensorId(String sensorId) { this.sensorId = sensorId; }

    public String getLocationName() { return locationName; }
    public void setLocationName(String locationName) { this.locationName = locationName; }

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
}