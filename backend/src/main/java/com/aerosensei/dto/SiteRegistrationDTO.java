package com.aerosensei.dto;

import java.math.BigDecimal;

public class SiteRegistrationDTO {
    private Long companyId;
    private String siteName;
    private BigDecimal latitude;
    private BigDecimal longitude;

    // Constructors
    public SiteRegistrationDTO() {}

    // Getters and Setters
    public Integer getCompanyId() { return companyId; }
    public void setCompanyId(Integer companyId) { this.companyId = companyId; }

    public String getSiteName() { return siteName; }
    public void setSiteName(String siteName) { this.siteName = siteName; }

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
}
