package com.aerosensei.dto;

import java.math.BigDecimal;

public class CompanyOverviewResponse {
    private Long companyId;
    private String email;
    private String companyName;
    private BigDecimal currentCredits;
    private BigDecimal monthlyChange;
    private Long sectorId;
    private String sectorName;

    public CompanyOverviewResponse(Long companyId, String email, String companyName,
                                    BigDecimal currentCredits, BigDecimal monthlyChange,
                                    Long sectorId, String sectorName) {
        this.companyId = companyId;
        this.email = email;
        this.companyName = companyName;
        this.currentCredits = currentCredits;
        this.monthlyChange = monthlyChange;
        this.sectorId = sectorId;
        this.sectorName = sectorName;
    }

    public Long getCompanyId() { return companyId; }
    public String getEmail() { return email; }
    public String getCompanyName() { return companyName; }
    public BigDecimal getCurrentCredits() { return currentCredits; }
    public BigDecimal getMonthlyChange() { return monthlyChange; }
    public Long getSectorId() { return sectorId; }
    public String getSectorName() { return sectorName; }
}
