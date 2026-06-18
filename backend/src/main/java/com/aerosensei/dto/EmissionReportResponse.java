package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

public class EmissionReportResponse {

    private Long id;
    private Long companyId;
    private String companyName;
    private String sectorName;
    private Integer year;
    private String reportType;
    private BigDecimal activityLevel;
    private BigDecimal verifiedEmissions;
    private Map<String, Object> parameters;   // raw inputs the company submitted (may be null)
    private LocalDateTime submittedAt;

    public EmissionReportResponse(Long id, Long companyId, String companyName, String sectorName,
                                  Integer year, String reportType, BigDecimal activityLevel,
                                  BigDecimal verifiedEmissions, Map<String, Object> parameters,
                                  LocalDateTime submittedAt) {
        this.id = id;
        this.companyId = companyId;
        this.companyName = companyName;
        this.sectorName = sectorName;
        this.year = year;
        this.reportType = reportType;
        this.activityLevel = activityLevel;
        this.verifiedEmissions = verifiedEmissions;
        this.parameters = parameters;
        this.submittedAt = submittedAt;
    }

    public Long getId() { return id; }
    public Long getCompanyId() { return companyId; }
    public String getCompanyName() { return companyName; }
    public String getSectorName() { return sectorName; }
    public Integer getYear() { return year; }
    public String getReportType() { return reportType; }
    public BigDecimal getActivityLevel() { return activityLevel; }
    public BigDecimal getVerifiedEmissions() { return verifiedEmissions; }
    public Map<String, Object> getParameters() { return parameters; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
}
