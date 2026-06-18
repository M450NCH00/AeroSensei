package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.Instant;

public class SiteSensor15MinDTO {
    private String companyName;
    private String siteName;
    private String sensorId;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String status;
    private Double pm25;
    private Double pm10;
    private Instant lastCalculated;

    // Constructors, Getters, and Setters
    public SiteSensor15MinDTO() {}

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getSiteName() { return siteName; }
    public void setSiteName(String siteName) { this.siteName = siteName; }

    public String getSensorId() { return sensorId; }
    public void setSensorId(String sensorId) { this.sensorId = sensorId; }

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Double getPm25() { return pm25; }
    public void setPm25(Double pm25) { this.pm25 = pm25; }

    public Double getPm10() { return pm10; }
    public void setPm10(Double pm10) { this.pm10 = pm10; }

    public Instant getLastCalculated() { return lastCalculated; }
    public void setLastCalculated(Instant lastCalculated) { this.lastCalculated = lastCalculated; }
}