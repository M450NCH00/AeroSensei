package com.aerosensei.dto;

import java.math.BigDecimal;

/**
 * A company's compliance position for a given year: what it was granted, what it
 * actually emitted, and whether its current holdings cover that obligation.
 */
public class CompliancePositionResponse {

    private Long companyId;
    private Integer year;
    private String phase;             // current cycle phase for the year
    private String status;            // ledger status (PRE_ALLOCATED/ALLOCATED/SETTLED) or null
    private BigDecimal preAllocation;
    private BigDecimal finalAllocation;
    private BigDecimal verifiedEmissions;
    private BigDecimal totalBalance;       // companies.carbon_credits (carries forward)
    private BigDecimal surplusDeficit;     // finalAllocation - verifiedEmissions (year efficiency; >0 surplus, <0 deficit)

    public CompliancePositionResponse(Long companyId, Integer year, String phase, String status,
                                      BigDecimal preAllocation, BigDecimal finalAllocation,
                                      BigDecimal verifiedEmissions, BigDecimal totalBalance,
                                      BigDecimal surplusDeficit) {
        this.companyId = companyId;
        this.year = year;
        this.phase = phase;
        this.status = status;
        this.preAllocation = preAllocation;
        this.finalAllocation = finalAllocation;
        this.verifiedEmissions = verifiedEmissions;
        this.totalBalance = totalBalance;
        this.surplusDeficit = surplusDeficit;
    }

    public Long getCompanyId() { return companyId; }
    public Integer getYear() { return year; }
    public String getPhase() { return phase; }
    public String getStatus() { return status; }
    public BigDecimal getPreAllocation() { return preAllocation; }
    public BigDecimal getFinalAllocation() { return finalAllocation; }
    public BigDecimal getVerifiedEmissions() { return verifiedEmissions; }
    public BigDecimal getTotalBalance() { return totalBalance; }
    public BigDecimal getSurplusDeficit() { return surplusDeficit; }
}
