package com.aerosensei.dto;

public class SectorDTO {
    private Long id;
    private String name;
    private String formula;
    private String activityFormula;
    private String description;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getFormula() { return formula; }
    public void setFormula(String formula) { this.formula = formula; }

    public String getActivityFormula() { return activityFormula; }
    public void setActivityFormula(String activityFormula) { this.activityFormula = activityFormula; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
