package com.aerosensei.dto;

import java.io.Serializable;
import java.math.BigDecimal;

public class SensorSimpleDTO implements Serializable {
    private String id;
    private String status;

    // Constructors
    public SensorSimpleDTO() {}

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
