package com.aerosensei.dto;

import com.aerosensei.enums.PMBreachType;
import com.aerosensei.enums.SiteState;

import java.math.BigDecimal;
import java.time.Instant;

public class SiteSensor15MinDTO {
    private String companyName;
    private String siteName;
    private String sensorId;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String status;
    private Double avgpm25;
    private Double avgpm10;
    private Double maxpm25;
    private Double maxpm10;
    private PMBreachType breachType;
    private SiteState state;
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

    public Double getAvgPm25() { return avgpm25; }
    public void setAvgPm25(Double avgpm25) { this.avgpm25 = avgpm25; }

    public Double getAvgPm10() { return avgpm10; }
    public void setAvgPm10(Double avgpm10) { this.avgpm10 = avgpm10; }

    public Double getMaxPm25() { return maxpm25; }
    public void setMaxPm25(Double maxpm25) { this.maxpm25 = maxpm25; }

    public Double getMaxPm10() { return maxpm10; }
    public void setMaxPm10(Double maxpm10) { this.maxpm10 = maxpm10; }

    public PMBreachType getBreachType() { return breachType; }
    public void setBreachType(PMBreachType breachType) { this.breachType = breachType; }

    public SiteState getState() { return state; }
    public void setState(SiteState state) { this.state = state; }

    public Instant getLastCalculated() { return lastCalculated; }
    public void setLastCalculated(Instant lastCalculated) { this.lastCalculated = lastCalculated; }
}