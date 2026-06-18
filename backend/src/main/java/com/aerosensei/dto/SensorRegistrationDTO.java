package com.aerosensei.dto;

import java.math.BigDecimal;

public class SensorRegistrationDTO {
    private String sensorId;
    private Integer siteId;
    private BigDecimal latitude;
    private BigDecimal longitude;

    // Constructors
    public SensorRegistrationDTO() {}

    // Getters and Setters
    public String getSensorId() { return sensorId; }
    public void setSensorId(String sensorId) { this.sensorId = sensorId; }

    public Integer getSiteId() { return siteId; }
    public void setSiteId(Integer siteId) { this.siteId = siteId; }

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
}