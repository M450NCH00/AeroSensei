package com.aerosensei.dto;

import java.io.Serializable;
import java.math.BigDecimal;

public class SiteSimpleDTO implements Serializable {
    private Integer id;
    private String siteName;
    private BigDecimal latitude;
    private BigDecimal longitude;

    // Constructors
    public SiteSimpleDTO() {}
    public SiteSimpleDTO(Integer id, String siteName, BigDecimal latitude, BigDecimal longitude) {
        this.id = id;
        this.siteName = siteName;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    // Getters and Setters
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getSiteName() { return siteName; }
    public void setSiteName(String siteName) { this.siteName = siteName; }

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
}