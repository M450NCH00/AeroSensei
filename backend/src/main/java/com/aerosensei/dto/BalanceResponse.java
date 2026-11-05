package com.aerosensei.dto;

import java.math.BigDecimal;

public class BalanceResponse {
    private Long companyId;
    private BigDecimal carbonCredits;

    public BalanceResponse(Long companyId, BigDecimal carbonCredits) {
        this.companyId = companyId;
        this.carbonCredits = carbonCredits;
    }

    public Long getCompanyId() { return companyId; }
    public BigDecimal getCarbonCredits() { return carbonCredits; }
}
