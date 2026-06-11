package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class CarbonTransactionResponse {
    private Long id;
    private String fromEmail;
    private String toEmail;
    private BigDecimal amount;
    private BigDecimal totalPrice;
    private LocalDateTime createdAt;

    public CarbonTransactionResponse(Long id, String fromEmail, String toEmail,
                                      BigDecimal amount, BigDecimal totalPrice, LocalDateTime createdAt) {
        this.id = id;
        this.fromEmail = fromEmail;
        this.toEmail = toEmail;
        this.amount = amount;
        this.totalPrice = totalPrice;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getFromEmail() { return fromEmail; }
    public String getToEmail() { return toEmail; }
    public BigDecimal getAmount() { return amount; }
    public BigDecimal getTotalPrice() { return totalPrice; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
