package com.aerosensei.dto;

import java.math.BigDecimal;

public class ClusterMaxDTO {
    private BigDecimal centerLat;
    private BigDecimal centerLon;
    private Double maxPm25;
    private Double maxPm10;
    private int sensorCount; // Tells frontend how many sensors were merged here!

    // Constructors, Getters, and Setters
    public ClusterMaxDTO(BigDecimal centerLat, BigDecimal centerLon, Double maxPm25, Double maxPm10, int sensorCount) {
        this.centerLat = centerLat;
        this.centerLon = centerLon;
        this.maxPm25 = maxPm25;
        this.maxPm10 = maxPm10;
        this.sensorCount = sensorCount;
    }

    public BigDecimal getCenterLat() { return centerLat; }
    public BigDecimal getCenterLon() { return centerLon; }
    public Double getMaxPm25() { return maxPm25; }
    public Double getMaxPm10() { return maxPm10; }
    public int getSensorCount() { return sensorCount; }
}