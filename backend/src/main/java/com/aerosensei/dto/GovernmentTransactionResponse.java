package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class GovernmentTransactionResponse {
    private Long id;
    private String sellerEmail;
    private String buyerEmail;
    private BigDecimal amount;
    private BigDecimal pricePerCredit;
    private BigDecimal totalPrice;
    private LocalDateTime createdAt;

    public GovernmentTransactionResponse(Long id, String sellerEmail, String buyerEmail,
                                          BigDecimal amount, BigDecimal pricePerCredit,
                                          BigDecimal totalPrice, LocalDateTime createdAt) {
        this.id = id;
        this.sellerEmail = sellerEmail;
        this.buyerEmail = buyerEmail;
        this.amount = amount;
        this.pricePerCredit = pricePerCredit;
        this.totalPrice = totalPrice;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getSellerEmail() { return sellerEmail; }
    public String getBuyerEmail() { return buyerEmail; }
    public BigDecimal getAmount() { return amount; }
    public BigDecimal getPricePerCredit() { return pricePerCredit; }
    public BigDecimal getTotalPrice() { return totalPrice; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
