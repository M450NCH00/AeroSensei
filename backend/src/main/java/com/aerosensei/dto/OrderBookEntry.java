package com.aerosensei.dto;

import java.math.BigDecimal;

public class OrderBookEntry {
    private String type;
    private BigDecimal pricePerCredit;
    private BigDecimal totalCredits;

    public OrderBookEntry(String type, BigDecimal pricePerCredit, BigDecimal totalCredits) {
        this.type = type;
        this.pricePerCredit = pricePerCredit;
        this.totalCredits = totalCredits;
    }

    public String getType() { return type; }
    public BigDecimal getPricePerCredit() { return pricePerCredit; }
    public BigDecimal getTotalCredits() { return totalCredits; }
}
