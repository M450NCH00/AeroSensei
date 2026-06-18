package com.aerosensei.dto;

import java.time.Instant;

public class SiteHistoricalDataDTO {
    private Instant timestamp;
    private Double pm25;
    private Double pm10;

    public SiteHistoricalDataDTO() {}

    public SiteHistoricalDataDTO(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public Double getPm25() { return pm25; }
    public void setPm25(Double pm25) { this.pm25 = pm25; }

    public Double getPm10() { return pm10; }
    public void setPm10(Double pm10) { this.pm10 = pm10; }
}