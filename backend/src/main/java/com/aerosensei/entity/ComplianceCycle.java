package com.aerosensei.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Tracks which phase of the China ETS compliance cycle a given year is in.
 * Phases are advanced manually by a GOVERNMENT/ADMIN user:
 *   PENDING -> PRE_ALLOCATED -> MIDYEAR_OPEN -> FINAL_OPEN -> ALLOCATED -> SETTLED
 */
@Entity
@Table(name = "compliance_cycles", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"year"})
})
public class ComplianceCycle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Integer year;

    @Column(nullable = false, length = 20)
    private String phase = "PENDING";

    @Column(name = "pre_allocated_at")
    private LocalDateTime preAllocatedAt;

    @Column(name = "midyear_opened_at")
    private LocalDateTime midyearOpenedAt;

    @Column(name = "final_opened_at")
    private LocalDateTime finalOpenedAt;

    @Column(name = "allocated_at")
    private LocalDateTime allocatedAt;

    @Column(name = "settled_at")
    private LocalDateTime settledAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }

    public String getPhase() { return phase; }
    public void setPhase(String phase) { this.phase = phase; }

    public LocalDateTime getPreAllocatedAt() { return preAllocatedAt; }
    public void setPreAllocatedAt(LocalDateTime preAllocatedAt) { this.preAllocatedAt = preAllocatedAt; }

    public LocalDateTime getMidyearOpenedAt() { return midyearOpenedAt; }
    public void setMidyearOpenedAt(LocalDateTime midyearOpenedAt) { this.midyearOpenedAt = midyearOpenedAt; }

    public LocalDateTime getFinalOpenedAt() { return finalOpenedAt; }
    public void setFinalOpenedAt(LocalDateTime finalOpenedAt) { this.finalOpenedAt = finalOpenedAt; }

    public LocalDateTime getAllocatedAt() { return allocatedAt; }
    public void setAllocatedAt(LocalDateTime allocatedAt) { this.allocatedAt = allocatedAt; }

    public LocalDateTime getSettledAt() { return settledAt; }
    public void setSettledAt(LocalDateTime settledAt) { this.settledAt = settledAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
