package com.aerosensei.dto;

public class CompanySimpleDTO {
    private Integer id;
    private String companyName;

    // Constructors
    public CompanySimpleDTO() {}
    public CompanySimpleDTO(Integer id, String companyName) {
        this.id = id;
        this.companyName = companyName;
    }

    // Getters and Setters
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
}