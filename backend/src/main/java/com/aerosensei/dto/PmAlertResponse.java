package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** A PM-breach alert enriched with sensor location + owning company, plus whether
 *  a fine has already been issued against it. */
public class PmAlertResponse {
    private Long id;
    private Long siteId;
    private String siteName;
    private Long companyId;
    private String companyName;
    private String pmType;
    private BigDecimal measuredValue;
    private BigDecimal thresholdValue;
    private String alertLevel;
    private LocalDateTime triggeredAt;
    private LocalDateTime resolvedAt;
    private String note;
    private boolean fined;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSiteId() { return siteId; }
    public void setSiteId(Long siteId) { this.siteId = siteId; }

    public String getSiteName() { return siteName; }
    public void setSiteName(String siteName) { this.siteName = siteName; }

    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getPmType() { return pmType; }
    public void setPmType(String pmType) { this.pmType = pmType; }

    public BigDecimal getMeasuredValue() { return measuredValue; }
    public void setMeasuredValue(BigDecimal measuredValue) { this.measuredValue = measuredValue; }

    public BigDecimal getThresholdValue() { return thresholdValue; }
    public void setThresholdValue(BigDecimal thresholdValue) { this.thresholdValue = thresholdValue; }

    public String getAlertLevel() { return alertLevel; }
    public void setAlertLevel(String alertLevel) { this.alertLevel = alertLevel; }

    public LocalDateTime getTriggeredAt() { return triggeredAt; }
    public void setTriggeredAt(LocalDateTime triggeredAt) { this.triggeredAt = triggeredAt; }

    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public boolean isFined() { return fined; }
    public void setFined(boolean fined) { this.fined = fined; }
}
