package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class EmissionReportResponse {

    private Long id;
    private Long companyId;
    private String companyName;
    private String sectorName;
    private Integer year;
    private BigDecimal activityLevel;
    private BigDecimal verifiedEmissions;
    private LocalDateTime submittedAt;

    public EmissionReportResponse(Long id, Long companyId, String companyName, String sectorName,
                                  Integer year, BigDecimal activityLevel, BigDecimal verifiedEmissions,
                                  LocalDateTime submittedAt) {
        this.id = id;
        this.companyId = companyId;
        this.companyName = companyName;
        this.sectorName = sectorName;
        this.year = year;
        this.activityLevel = activityLevel;
        this.verifiedEmissions = verifiedEmissions;
        this.submittedAt = submittedAt;
    }

    public Long getId() { return id; }
    public Long getCompanyId() { return companyId; }
    public String getCompanyName() { return companyName; }
    public String getSectorName() { return sectorName; }
    public Integer getYear() { return year; }
    public BigDecimal getActivityLevel() { return activityLevel; }
    public BigDecimal getVerifiedEmissions() { return verifiedEmissions; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
}
