package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class CarbonTransactionResponse {
    private Long id;
    private String orderType; // "buy" or "sell"
    private BigDecimal amount;
    private BigDecimal pricePerCredit;
    private BigDecimal totalPrice;
    private LocalDateTime createdAt;

    public CarbonTransactionResponse(Long id, String orderType, BigDecimal amount,
                                      BigDecimal pricePerCredit, BigDecimal totalPrice,
                                      LocalDateTime createdAt) {
        this.id = id;
        this.orderType = orderType;
        this.amount = amount;
        this.pricePerCredit = pricePerCredit;
        this.totalPrice = totalPrice;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getOrderType() { return orderType; }
    public BigDecimal getAmount() { return amount; }
    public BigDecimal getPricePerCredit() { return pricePerCredit; }
    public BigDecimal getTotalPrice() { return totalPrice; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
