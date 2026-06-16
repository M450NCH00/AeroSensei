package com.aerosensei.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "carbon_allocations", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"company_id", "year"})
})
public class CarbonAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(nullable = false)
    private Integer year;

    @Column(name = "verified_emissions", nullable = false, precision = 15, scale = 4)
    private BigDecimal verifiedEmissions;

    @Column(name = "activity_level", nullable = false, precision = 15, scale = 4)
    private BigDecimal activityLevel;

    @Column(nullable = false, precision = 15, scale = 6)
    private BigDecimal intensity;

    @Column(name = "benchmark_intensity", nullable = false, precision = 15, scale = 6)
    private BigDecimal benchmarkIntensity;

    @Column(name = "deviation_pct", nullable = false, precision = 8, scale = 4)
    private BigDecimal deviationPct;

    @Column(name = "allocation_amount", nullable = false, precision = 15, scale = 4)
    private BigDecimal allocationAmount;

    @Column(name = "allocated_at")
    private LocalDateTime allocatedAt;

    @PrePersist
    protected void onCreate() {
        if (allocatedAt == null) {
            allocatedAt = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Company getCompany() { return company; }
    public void setCompany(Company company) { this.company = company; }

    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }

    public BigDecimal getVerifiedEmissions() { return verifiedEmissions; }
    public void setVerifiedEmissions(BigDecimal verifiedEmissions) { this.verifiedEmissions = verifiedEmissions; }

    public BigDecimal getActivityLevel() { return activityLevel; }
    public void setActivityLevel(BigDecimal activityLevel) { this.activityLevel = activityLevel; }

    public BigDecimal getIntensity() { return intensity; }
    public void setIntensity(BigDecimal intensity) { this.intensity = intensity; }

    public BigDecimal getBenchmarkIntensity() { return benchmarkIntensity; }
    public void setBenchmarkIntensity(BigDecimal benchmarkIntensity) { this.benchmarkIntensity = benchmarkIntensity; }

    public BigDecimal getDeviationPct() { return deviationPct; }
    public void setDeviationPct(BigDecimal deviationPct) { this.deviationPct = deviationPct; }

    public BigDecimal getAllocationAmount() { return allocationAmount; }
    public void setAllocationAmount(BigDecimal allocationAmount) { this.allocationAmount = allocationAmount; }

    public LocalDateTime getAllocatedAt() { return allocatedAt; }
    public void setAllocatedAt(LocalDateTime allocatedAt) { this.allocatedAt = allocatedAt; }
}
