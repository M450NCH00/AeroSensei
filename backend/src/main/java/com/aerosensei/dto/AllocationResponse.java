package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class AllocationResponse {

    private Long id;
    private Long companyId;
    private String companyName;
    private String sectorName;
    private Integer year;
    private BigDecimal verifiedEmissions;
    private BigDecimal activityLevel;
    private BigDecimal intensity;
    private BigDecimal benchmarkIntensity;
    private BigDecimal deviationPct;
    private BigDecimal allocationAmount;
    private LocalDateTime allocatedAt;

    public AllocationResponse(Long id, Long companyId, String companyName, String sectorName,
                              Integer year, BigDecimal verifiedEmissions, BigDecimal activityLevel,
                              BigDecimal intensity, BigDecimal benchmarkIntensity,
                              BigDecimal deviationPct, BigDecimal allocationAmount,
                              LocalDateTime allocatedAt) {
        this.id = id;
        this.companyId = companyId;
        this.companyName = companyName;
        this.sectorName = sectorName;
        this.year = year;
        this.verifiedEmissions = verifiedEmissions;
        this.activityLevel = activityLevel;
        this.intensity = intensity;
        this.benchmarkIntensity = benchmarkIntensity;
        this.deviationPct = deviationPct;
        this.allocationAmount = allocationAmount;
        this.allocatedAt = allocatedAt;
    }

    public Long getId() { return id; }
    public Long getCompanyId() { return companyId; }
    public String getCompanyName() { return companyName; }
    public String getSectorName() { return sectorName; }
    public Integer getYear() { return year; }
    public BigDecimal getVerifiedEmissions() { return verifiedEmissions; }
    public BigDecimal getActivityLevel() { return activityLevel; }
    public BigDecimal getIntensity() { return intensity; }
    public BigDecimal getBenchmarkIntensity() { return benchmarkIntensity; }
    public BigDecimal getDeviationPct() { return deviationPct; }
    public BigDecimal getAllocationAmount() { return allocationAmount; }
    public LocalDateTime getAllocatedAt() { return allocatedAt; }
}
