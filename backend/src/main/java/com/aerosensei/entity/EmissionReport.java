package com.aerosensei.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "emission_reports", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"company_id", "year", "report_type"})
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

    // 'MIDYEAR' (informational MRV) or 'FINAL' (drives final allocation)
    @Column(name = "report_type", nullable = false, length = 10)
    private String reportType = "FINAL";

    @Column(name = "activity_level", nullable = false, precision = 15, scale = 4)
    private BigDecimal activityLevel;

    @Column(name = "verified_emissions", nullable = false, precision = 15, scale = 4)
    private BigDecimal verifiedEmissions;

    // Raw per-variable inputs submitted by the company (JSON string)
    @Column(name = "parameters", columnDefinition = "TEXT")
    private String parameters;

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

    public String getReportType() { return reportType; }
    public void setReportType(String reportType) { this.reportType = reportType; }

    public BigDecimal getActivityLevel() { return activityLevel; }
    public void setActivityLevel(BigDecimal activityLevel) { this.activityLevel = activityLevel; }

    public BigDecimal getVerifiedEmissions() { return verifiedEmissions; }
    public void setVerifiedEmissions(BigDecimal verifiedEmissions) { this.verifiedEmissions = verifiedEmissions; }

    public String getParameters() { return parameters; }
    public void setParameters(String parameters) { this.parameters = parameters; }

    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }
}
