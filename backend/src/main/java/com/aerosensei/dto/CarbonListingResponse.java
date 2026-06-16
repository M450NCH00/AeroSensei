package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class CarbonListingResponse {
    private Long id;
    private String type;
    private String sellerEmail;
    private String buyerEmail;
    private BigDecimal creditsAmount;
    private BigDecimal remainingCredits;
    private BigDecimal pricePerCredit;
    private BigDecimal totalPrice;
    private String status;
    private LocalDateTime createdAt;

    public CarbonListingResponse(Long id, String type, String sellerEmail, String buyerEmail,
                                  BigDecimal creditsAmount, BigDecimal remainingCredits,
                                  BigDecimal pricePerCredit, BigDecimal totalPrice,
                                  String status, LocalDateTime createdAt) {
        this.id = id;
        this.type = type;
        this.sellerEmail = sellerEmail;
        this.buyerEmail = buyerEmail;
        this.creditsAmount = creditsAmount;
        this.remainingCredits = remainingCredits;
        this.pricePerCredit = pricePerCredit;
        this.totalPrice = totalPrice;
        this.status = status;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getType() { return type; }
    public String getSellerEmail() { return sellerEmail; }
    public String getBuyerEmail() { return buyerEmail; }
    public BigDecimal getCreditsAmount() { return creditsAmount; }
    public BigDecimal getRemainingCredits() { return remainingCredits; }
    public BigDecimal getPricePerCredit() { return pricePerCredit; }
    public BigDecimal getTotalPrice() { return totalPrice; }
    public String getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
