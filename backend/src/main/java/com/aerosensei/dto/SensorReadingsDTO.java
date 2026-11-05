package com.aerosensei.dto;

import java.io.Serializable;
import java.time.Instant;

import com.aerosensei.enums.PMBreachType;
import com.aerosensei.enums.SiteState;

public class SensorReadingsDTO implements Serializable {
    private String sensorId;
    private String locationName;
    private Double avgpm25;
    private Double avgpm10;
    private Double maxpm25;
    private Double maxpm10;
    private PMBreachType breachType;
    private SiteState state;
    private Instant lastCalculated;

    // Default Constructor for Redis
    public SensorReadingsDTO() {}

    // Getters and Setters
    public String getSensorId() { return sensorId; }
    public void setSensorId(String sensorId) { this.sensorId = sensorId; }

    public String getLocationName() { return locationName; }
    public void setLocationName(String locationName) { this.locationName = locationName; }

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