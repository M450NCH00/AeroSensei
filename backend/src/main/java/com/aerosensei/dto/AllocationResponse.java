package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class AllocationResponse {

    private Long id;
    private Long companyId;
    private String companyName;
    private String sectorName;
    private Integer year;
    private BigDecimal preAllocation;
    private BigDecimal verifiedEmissions;
    private BigDecimal activityLevel;
    private BigDecimal intensity;
    private BigDecimal benchmarkIntensity;
    private BigDecimal deviationPct;
    private BigDecimal allocationAmount;
    private BigDecimal surplusDeficit;
    private String status;
    private LocalDateTime allocatedAt;

    public AllocationResponse(Long id, Long companyId, String companyName, String sectorName,
                              Integer year, BigDecimal preAllocation, BigDecimal verifiedEmissions,
                              BigDecimal activityLevel, BigDecimal intensity, BigDecimal benchmarkIntensity,
                              BigDecimal deviationPct, BigDecimal allocationAmount,
                              BigDecimal surplusDeficit, String status,
                              LocalDateTime allocatedAt) {
        this.id = id;
        this.companyId = companyId;
        this.companyName = companyName;
        this.sectorName = sectorName;
        this.year = year;
        this.preAllocation = preAllocation;
        this.verifiedEmissions = verifiedEmissions;
        this.activityLevel = activityLevel;
        this.intensity = intensity;
        this.benchmarkIntensity = benchmarkIntensity;
        this.deviationPct = deviationPct;
        this.allocationAmount = allocationAmount;
        this.surplusDeficit = surplusDeficit;
        this.status = status;
        this.allocatedAt = allocatedAt;
    }

    public Long getId() { return id; }
    public Long getCompanyId() { return companyId; }
    public String getCompanyName() { return companyName; }
    public String getSectorName() { return sectorName; }
    public Integer getYear() { return year; }
    public BigDecimal getPreAllocation() { return preAllocation; }
    public BigDecimal getVerifiedEmissions() { return verifiedEmissions; }
    public BigDecimal getActivityLevel() { return activityLevel; }
    public BigDecimal getIntensity() { return intensity; }
    public BigDecimal getBenchmarkIntensity() { return benchmarkIntensity; }
    public BigDecimal getDeviationPct() { return deviationPct; }
    public BigDecimal getAllocationAmount() { return allocationAmount; }
    public BigDecimal getSurplusDeficit() { return surplusDeficit; }
    public String getStatus() { return status; }
    public LocalDateTime getAllocatedAt() { return allocatedAt; }
}
