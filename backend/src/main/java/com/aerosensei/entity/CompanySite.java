package com.aerosensei.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "company_sites")
public class CompanySite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id")
    private Company company;

    @Column(name = "site_name", length = 100, nullable = false)
    private String siteName;

    @Column(name = "pm2_5_value")
    private BigDecimal pm2_5;

    @Column(name = "pm10_value")
    private BigDecimal pm10;

    @Column(nullable = false, precision = 11, scale = 8)
    private BigDecimal latitude;

    @Column(nullable = false, precision = 11, scale = 8)
    private BigDecimal longitude;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    // Default Constructor
    public CompanySite() {}

    // --- Getters and Setters ---
    public Long getId() { return id; }
    
    public Company getCompany() { return company; }
    public void setCompany(Company company) { this.company = company; }

    public String getSiteName() { return siteName; }
    public void setSiteName(String siteName) { this.siteName = siteName; }

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }

    public BigDecimal getPm2_5() { return pm2_5; }
    public void setPm2_5(BigDecimal pm2_5) { this.pm2_5 = pm2_5; }

    public BigDecimal getPm10() { return pm10; }
    public void setPm10(BigDecimal pm10) { this.pm10 = pm10; }
}