package com.aerosensei.dto;

import java.math.BigDecimal;

public class ClusterAverageDTO {
    private BigDecimal centerLat;
    private BigDecimal centerLon;
    private Double avgPm25;
    private Double avgPm10;
    private int sensorCount; // Tells frontend how many sensors were merged here!

    // Constructors, Getters, and Setters
    public ClusterAverageDTO(BigDecimal centerLat, BigDecimal centerLon, Double avgPm25, Double avgPm10, int sensorCount) {
        this.centerLat = centerLat;
        this.centerLon = centerLon;
        this.avgPm25 = avgPm25;
        this.avgPm10 = avgPm10;
        this.sensorCount = sensorCount;
    }

    public BigDecimal getCenterLat() { return centerLat; }
    public BigDecimal getCenterLon() { return centerLon; }
    public Double getAvgPm25() { return avgPm25; }
    public Double getAvgPm10() { return avgPm10; }
    public int getSensorCount() { return sensorCount; }
}