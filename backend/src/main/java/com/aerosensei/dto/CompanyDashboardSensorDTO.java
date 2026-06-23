package com.aerosensei.dto;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

public class CompanyDashboardSensorDTO implements Serializable {
    private String companyName;
    private String siteName;
    private String sensorId;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String dbStatus;     // "active", "maintenance", etc. from Postgres

    // Live Data Fields
    private boolean online;      // True if data exists in the last 1 hour
    private Double pm25;
    private Double pm10;
    private Instant lastReadingTime;

    public CompanyDashboardSensorDTO() {}

    // --- Getters and Setters ---
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

    public String getDbStatus() { return dbStatus; }
    public void setDbStatus(String dbStatus) { this.dbStatus = dbStatus; }

    public boolean isOnline() { return online; }
    public void setOnline(boolean online) { this.online = online; }

    public Double getPm25() { return pm25; }
    public void setPm25(Double pm25) { this.pm25 = pm25; }

    public Double getPm10() { return pm10; }
    public void setPm10(Double pm10) { this.pm10 = pm10; }

    public Instant getLastReadingTime() { return lastReadingTime; }
    public void setLastReadingTime(Instant lastReadingTime) { this.lastReadingTime = lastReadingTime; }
}