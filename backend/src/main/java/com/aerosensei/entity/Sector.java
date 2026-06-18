package com.aerosensei.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "sectors")
public class Sector {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    // Emissions formula (tCO2e output)
    @Column(columnDefinition = "TEXT")
    private String formula;

    // Activity-level / output formula (the denominator of intensity)
    @Column(name = "activity_formula", columnDefinition = "TEXT")
    private String activityFormula;

    @Column(columnDefinition = "TEXT")
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
