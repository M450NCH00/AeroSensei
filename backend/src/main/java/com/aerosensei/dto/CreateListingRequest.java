package com.aerosensei.dto;

import java.math.BigDecimal;

public class CreateListingRequest {
    private BigDecimal creditsAmount;
    private BigDecimal pricePerCredit;

    public BigDecimal getCreditsAmount() { return creditsAmount; }
    public void setCreditsAmount(BigDecimal creditsAmount) { this.creditsAmount = creditsAmount; }

    public BigDecimal getPricePerCredit() { return pricePerCredit; }
    public void setPricePerCredit(BigDecimal pricePerCredit) { this.pricePerCredit = pricePerCredit; }
}
