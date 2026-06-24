package com.aerosensei.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A PM-threshold breach recorded in the pm_alerts table, scoped to a company
 * SITE (written by the backend when a site's aggregated reading exceeds its
 * threshold). Read-only from the app's POV.
 */
@Entity
@Table(name = "pm_alerts")
public class PmAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "site_id")
    private Long siteId;

    @Column(name = "pm_type", length = 10)
    private String pmType;

    @Column(name = "measured_value", precision = 10, scale = 2)
    private BigDecimal measuredValue;

    @Column(name = "threshold_value", precision = 10, scale = 2)
    private BigDecimal thresholdValue;

    @Column(name = "alert_level", length = 20)
    private String alertLevel;

    @Column(name = "triggered_at", insertable = false, updatable = false)
    private LocalDateTime triggeredAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "note")
    private String note;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSiteId() { return siteId; }
    public void setSiteId(Long siteId) { this.siteId = siteId; }

    public String getPmType() { return pmType; }
    public void setPmType(String pmType) { this.pmType = pmType; }

    public BigDecimal getMeasuredValue() { return measuredValue; }
    public void setMeasuredValue(BigDecimal measuredValue) { this.measuredValue = measuredValue; }

    public BigDecimal getThresholdValue() { return thresholdValue; }
    public void setThresholdValue(BigDecimal thresholdValue) { this.thresholdValue = thresholdValue; }

    public String getAlertLevel() { return alertLevel; }
    public void setAlertLevel(String alertLevel) { this.alertLevel = alertLevel; }

    public LocalDateTime getTriggeredAt() { return triggeredAt; }

    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
