package com.aerosensei.dto;

import java.math.BigDecimal;
import java.util.List;

public class ForecastResponseDTO {
    private String site_id;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String pm2_5;
    private String pm10;
    private List<String> prediction;

    // Getters and Setters
    public String getSite_id() { return site_id; }
    public void setSite_id(String site_id) { this.site_id = site_id; }

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }

    public String getPm2_5() { return pm2_5; }
    public void setPm2_5(String pm2_5) { this.pm2_5 = pm2_5; }

    public String getPm10() { return pm10; }
    public void setPm10(String pm10) { this.pm10 = pm10; }

    public List<String> getPrediction() { return prediction; }
    public void setPrediction(List<String> prediction) { this.prediction = prediction; }
}