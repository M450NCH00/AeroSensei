package com.aerosensei.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A monetary penalty the government imposes against a PM-breach alert. site_id
 * and company_id are denormalized from the originating alert so the fine remains
 * meaningful even if the alert row is later removed.
 */
@Entity
@Table(name = "fines")
public class Fine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "alert_id")
    private Long alertId;

    @Column(name = "site_id")
    private Long siteId;

    @Column(name = "company_id")
    private Long companyId;

    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "reason")
    private String reason;

    @Column(name = "status", length = 20, nullable = false)
    private String status = "issued";

    @Column(name = "issued_by")
    private String issuedBy;

    @Column(name = "issued_at", insertable = false, updatable = false)
    private LocalDateTime issuedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAlertId() { return alertId; }
    public void setAlertId(Long alertId) { this.alertId = alertId; }

    public Long getSiteId() { return siteId; }
    public void setSiteId(Long siteId) { this.siteId = siteId; }

    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getIssuedBy() { return issuedBy; }
    public void setIssuedBy(String issuedBy) { this.issuedBy = issuedBy; }

    public LocalDateTime getIssuedAt() { return issuedAt; }
}
