package com.aerosensei.dto;

public class SiteSimpleDTO {
    private Integer id;
    private String siteName;

    // Constructors
    public SiteSimpleDTO() {}
    public SiteSimpleDTO(Integer id, String siteName) {
        this.id = id;
        this.siteName = siteName;
    }

    // Getters and Setters
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getSiteName() { return siteName; }
    public void setSiteName(String siteName) { this.siteName = siteName; }
}