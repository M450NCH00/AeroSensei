package com.aerosensei.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "emission_reports", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"company_id", "year"})
})
public class EmissionReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(nullable = false)
    private Integer year;

    @Column(name = "activity_level", nullable = false, precision = 15, scale = 4)
    private BigDecimal activityLevel;

    @Column(name = "verified_emissions", nullable = false, precision = 15, scale = 4)
    private BigDecimal verifiedEmissions;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @PrePersist
    protected void onCreate() {
        if (submittedAt == null) {
            submittedAt = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Company getCompany() { return company; }
    public void setCompany(Company company) { this.company = company; }

    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }

    public BigDecimal getActivityLevel() { return activityLevel; }
    public void setActivityLevel(BigDecimal activityLevel) { this.activityLevel = activityLevel; }

    public BigDecimal getVerifiedEmissions() { return verifiedEmissions; }
    public void setVerifiedEmissions(BigDecimal verifiedEmissions) { this.verifiedEmissions = verifiedEmissions; }

    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }
}
