package com.aerosensei.dto;

import java.math.BigDecimal;

public class CompanyOverviewResponse {
    private Long companyId;
    private String email;
    private String companyName;
    private String industryType;
    private String scale;
    private BigDecimal currentCredits;
    private BigDecimal monthlyChange;

    public CompanyOverviewResponse(Long companyId, String email, String companyName,
                                    String industryType, String scale,
                                    BigDecimal currentCredits, BigDecimal monthlyChange) {
        this.companyId = companyId;
        this.email = email;
        this.companyName = companyName;
        this.industryType = industryType;
        this.scale = scale;
        this.currentCredits = currentCredits;
        this.monthlyChange = monthlyChange;
    }

    public Long getCompanyId() { return companyId; }
    public String getEmail() { return email; }
    public String getCompanyName() { return companyName; }
    public String getIndustryType() { return industryType; }
    public String getScale() { return scale; }
    public BigDecimal getCurrentCredits() { return currentCredits; }
    public BigDecimal getMonthlyChange() { return monthlyChange; }
}
