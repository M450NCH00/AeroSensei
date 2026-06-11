package com.aerosensei.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "carbon_transactions")
public class CarbonTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_company_id", nullable = false)
    private Company fromCompany;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_company_id", nullable = false)
    private Company toCompany;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private BigDecimal price;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "initiated_by")
    private User initiatedBy;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }

    public Company getFromCompany() { return fromCompany; }
    public void setFromCompany(Company fromCompany) { this.fromCompany = fromCompany; }

    public Company getToCompany() { return toCompany; }
    public void setToCompany(Company toCompany) { this.toCompany = toCompany; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }

    public User getInitiatedBy() { return initiatedBy; }
    public void setInitiatedBy(User initiatedBy) { this.initiatedBy = initiatedBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
