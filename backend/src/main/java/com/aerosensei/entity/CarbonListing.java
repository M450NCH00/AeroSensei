package com.aerosensei.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "carbon_listings")
public class CarbonListing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_company_id")
    private Company sellerCompany;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "buyer_company_id")
    private Company buyerCompany;

    @Column(name = "credits_amount", nullable = false)
    private BigDecimal creditsAmount;

    @Column(name = "remaining_credits", nullable = false)
    private BigDecimal remainingCredits;

    @Column(name = "price_per_credit", nullable = false)
    private BigDecimal pricePerCredit;

    @Column(nullable = false)
    private String status;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = "active";
        if (remainingCredits == null) remainingCredits = creditsAmount;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Company getSellerCompany() { return sellerCompany; }
    public void setSellerCompany(Company sellerCompany) { this.sellerCompany = sellerCompany; }

    public Company getBuyerCompany() { return buyerCompany; }
    public void setBuyerCompany(Company buyerCompany) { this.buyerCompany = buyerCompany; }

    public BigDecimal getCreditsAmount() { return creditsAmount; }
    public void setCreditsAmount(BigDecimal creditsAmount) { this.creditsAmount = creditsAmount; }

    public BigDecimal getRemainingCredits() { return remainingCredits; }
    public void setRemainingCredits(BigDecimal remainingCredits) { this.remainingCredits = remainingCredits; }

    public BigDecimal getPricePerCredit() { return pricePerCredit; }
    public void setPricePerCredit(BigDecimal pricePerCredit) { this.pricePerCredit = pricePerCredit; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
