package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class PriceHistoryPoint {
    private BigDecimal pricePerCredit;
    private BigDecimal amount;
    private LocalDateTime createdAt;

    public PriceHistoryPoint(BigDecimal pricePerCredit, BigDecimal amount, LocalDateTime createdAt) {
        this.pricePerCredit = pricePerCredit;
        this.amount = amount;
        this.createdAt = createdAt;
    }

    public BigDecimal getPricePerCredit() { return pricePerCredit; }
    public BigDecimal getAmount() { return amount; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
