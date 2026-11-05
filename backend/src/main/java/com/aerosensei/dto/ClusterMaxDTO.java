package com.aerosensei.dto;

import com.aerosensei.enums.PMBreachType;
import com.aerosensei.enums.SiteState;

import java.io.Serializable;
import java.math.BigDecimal;

public class ClusterMaxDTO implements Serializable {
    private String siteName;
    private BigDecimal centerLat;
    private BigDecimal centerLon;
    private Double maxAvgPm25;
    private Double maxAvgPm10;
    private Double maxPeakPm25;
    private Double maxPeakPm10;
    private PMBreachType breachType;
    private SiteState state;
    private int siteCount; // Tells frontend how many sensors were merged here!

    // Constructors, Getters, and Setters
    public ClusterMaxDTO() {};

    public String getSiteName() { return siteName; }
    public void setSiteName(String siteName) { this.siteName = siteName; }

    public BigDecimal getCenterLat() { return centerLat; }
    public void setCenterLat(BigDecimal centerLat) { this.centerLat = centerLat; }

    public BigDecimal getCenterLon() { return centerLon; }
    public void setCenterLon(BigDecimal centerLon) { this.centerLon = centerLon; }

    public Double getMaxAvgPm25() { return maxAvgPm25; }
    public void setMaxAvgPm25(Double maxAvgPm25) { this.maxAvgPm25 = maxAvgPm25; }

    public Double getMaxAvgPm10() { return maxAvgPm10; }
    public void setMaxAvgPm10(Double maxAvgPm10) { this.maxAvgPm10 = maxAvgPm10; }

    public Double getMaxPeakPm25() { return maxPeakPm25; }
    public void setMaxPeakPm25(Double maxPeakPm25) { this.maxPeakPm25 = maxPeakPm25; }

    public Double getMaxPeakPm10() { return maxPeakPm10; }
    public void setMaxPeakPm10(Double maxPeakPm10) { this.maxPeakPm10 = maxPeakPm10; }

    public PMBreachType getBreachType() { return breachType; }
    public void setBreachType(PMBreachType breachType) { this.breachType = breachType; }

    public SiteState getState() { return state; }
    public void setState(SiteState state) { this.state = state; }

    public int getSiteCount() { return siteCount; }
    public void setSiteCount(int siteCount) { this.siteCount = siteCount; }
}