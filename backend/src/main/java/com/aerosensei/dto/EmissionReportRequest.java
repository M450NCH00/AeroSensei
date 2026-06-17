package com.aerosensei.dto;

import java.math.BigDecimal;
import java.util.Map;

public class EmissionReportRequest {

    private Integer year;
    // Direct totals — used as a fallback when the company has no sector formulas.
    private BigDecimal activityLevel;
    private BigDecimal verifiedEmissions;
    // Raw per-variable inputs for the company's sector formulas. When present,
    // activityLevel and verifiedEmissions are computed from these on the server.
    private Map<String, Object> parameters;
    // 'MIDYEAR' or 'FINAL'; defaults to FINAL when omitted.
    private String reportType = "FINAL";

    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }

    public Map<String, Object> getParameters() { return parameters; }
    public void setParameters(Map<String, Object> parameters) { this.parameters = parameters; }

    public String getReportType() { return reportType; }
    public void setReportType(String reportType) { this.reportType = reportType; }

    public BigDecimal getActivityLevel() { return activityLevel; }
    public void setActivityLevel(BigDecimal activityLevel) { this.activityLevel = activityLevel; }

    public BigDecimal getVerifiedEmissions() { return verifiedEmissions; }
    public void setVerifiedEmissions(BigDecimal verifiedEmissions) { this.verifiedEmissions = verifiedEmissions; }
}
