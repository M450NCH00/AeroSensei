package com.aerosensei.dto;

import java.math.BigDecimal;

public class EmissionReportRequest {

    private Integer year;
    private BigDecimal activityLevel;
    private BigDecimal verifiedEmissions;

    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }

    public BigDecimal getActivityLevel() { return activityLevel; }
    public void setActivityLevel(BigDecimal activityLevel) { this.activityLevel = activityLevel; }

    public BigDecimal getVerifiedEmissions() { return verifiedEmissions; }
    public void setVerifiedEmissions(BigDecimal verifiedEmissions) { this.verifiedEmissions = verifiedEmissions; }
}
