package com.aerosensei.dto;

import java.time.LocalDateTime;

public class ComplianceCycleResponse {

    private Integer year;
    private String phase;
    private LocalDateTime preAllocatedAt;
    private LocalDateTime midyearOpenedAt;
    private LocalDateTime finalOpenedAt;
    private LocalDateTime allocatedAt;
    private LocalDateTime settledAt;

    public ComplianceCycleResponse(Integer year, String phase, LocalDateTime preAllocatedAt,
                                   LocalDateTime midyearOpenedAt, LocalDateTime finalOpenedAt,
                                   LocalDateTime allocatedAt, LocalDateTime settledAt) {
        this.year = year;
        this.phase = phase;
        this.preAllocatedAt = preAllocatedAt;
        this.midyearOpenedAt = midyearOpenedAt;
        this.finalOpenedAt = finalOpenedAt;
        this.allocatedAt = allocatedAt;
        this.settledAt = settledAt;
    }

    public Integer getYear() { return year; }
    public String getPhase() { return phase; }
    public LocalDateTime getPreAllocatedAt() { return preAllocatedAt; }
    public LocalDateTime getMidyearOpenedAt() { return midyearOpenedAt; }
    public LocalDateTime getFinalOpenedAt() { return finalOpenedAt; }
    public LocalDateTime getAllocatedAt() { return allocatedAt; }
    public LocalDateTime getSettledAt() { return settledAt; }
}
