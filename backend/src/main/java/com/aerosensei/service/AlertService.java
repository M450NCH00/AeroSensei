package com.aerosensei.service;

import com.aerosensei.dto.FineResponse;
import com.aerosensei.dto.ImposeFineRequest;
import com.aerosensei.dto.PmAlertResponse;
import com.aerosensei.entity.Company;
import com.aerosensei.entity.CompanySite;
import com.aerosensei.entity.Fine;
import com.aerosensei.entity.PmAlert;
import com.aerosensei.repository.CompanyRepository;
import com.aerosensei.repository.CompanySiteRepository;
import com.aerosensei.repository.FineRepository;
import com.aerosensei.repository.PmAlertRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Government-facing service over PM-breach alerts and the fines raised against
 * them. Alerts are scoped to a company SITE; the owning company is resolved
 * through the site so a regulator can see who to penalize.
 */
@Service
public class AlertService {

    @Autowired
    private PmAlertRepository alertRepository;

    @Autowired
    private FineRepository fineRepository;

    @Autowired
    private CompanySiteRepository siteRepository;

    @Autowired
    private CompanyRepository companyRepository;

    /** All alerts, newest first, flagged with whether a fine already exists. */
    @Transactional(readOnly = true)
    public List<PmAlertResponse> listAlerts() {
        // Pre-load which alert ids have been fined so we don't query per-row.
        Map<Long, Boolean> finedByAlert = new HashMap<>();
        for (Fine f : fineRepository.findAll()) {
            if (f.getAlertId() != null) finedByAlert.put(f.getAlertId(), true);
        }
        return alertRepository.findAllByOrderByTriggeredAtDesc().stream()
                .map(a -> toAlertResponse(a, finedByAlert.getOrDefault(a.getId(), false)))
                .collect(Collectors.toList());
    }

    /** All fines, newest first. */
    @Transactional(readOnly = true)
    public List<FineResponse> listFines() {
        return fineRepository.findAllByOrderByIssuedAtDesc().stream()
                .map(this::toFineResponse)
                .collect(Collectors.toList());
    }

    /** Alerts for the authenticated company's own sites, newest first. */
    @Transactional(readOnly = true)
    public List<PmAlertResponse> listAlertsForCompany(String email) {
        Company company = companyRepository.findByUser_Email(email).orElse(null);
        if (company == null) return Collections.emptyList();

        List<Long> siteIds = siteRepository.findByCompanyId(company.getId().intValue()).stream()
                .map(CompanySite::getId)
                .collect(Collectors.toList());
        if (siteIds.isEmpty()) return Collections.emptyList();

        Map<Long, Boolean> finedByAlert = new HashMap<>();
        for (Fine f : fineRepository.findByCompanyIdOrderByIssuedAtDesc(company.getId())) {
            if (f.getAlertId() != null) finedByAlert.put(f.getAlertId(), true);
        }
        return alertRepository.findBySiteIdInOrderByTriggeredAtDesc(siteIds).stream()
                .map(a -> toAlertResponse(a, finedByAlert.getOrDefault(a.getId(), false)))
                .collect(Collectors.toList());
    }

    /** Fines issued against the authenticated company, newest first. */
    @Transactional(readOnly = true)
    public List<FineResponse> listFinesForCompany(String email) {
        Company company = companyRepository.findByUser_Email(email).orElse(null);
        if (company == null) return Collections.emptyList();
        return fineRepository.findByCompanyIdOrderByIssuedAtDesc(company.getId()).stream()
                .map(this::toFineResponse)
                .collect(Collectors.toList());
    }

    /**
     * Impose a fine against an alert. Resolves the offending company from the
     * alert's site and denormalizes it onto the fine.
     *
     * @throws IllegalArgumentException if the alert doesn't exist or the amount is invalid.
     * @throws IllegalStateException    if the alert has already been fined.
     */
    @Transactional
    public FineResponse imposeFine(Long alertId, ImposeFineRequest req, String issuedBy) {
        PmAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new IllegalArgumentException("Alert not found: " + alertId));

        if (req.getAmount() == null || req.getAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Fine amount must be zero or greater.");
        }
        if (!fineRepository.findByAlertId(alertId).isEmpty()) {
            throw new IllegalStateException("A fine has already been issued for this alert.");
        }

        CompanySite site = findSite(alert.getSiteId());
        Company company = site != null ? site.getCompany() : null;

        Fine fine = new Fine();
        fine.setAlertId(alert.getId());
        fine.setSiteId(alert.getSiteId());
        fine.setCompanyId(company != null ? company.getId() : null);
        fine.setAmount(req.getAmount());
        fine.setReason(req.getReason());
        fine.setStatus("issued");
        fine.setIssuedBy(issuedBy);

        return toFineResponse(fineRepository.save(fine));
    }

    /**
     * Demo helper: impose a fine on every BREACHED alert that hasn't been fined yet,
     * with an amount scaled by how far the reading exceeded its threshold (mirroring
     * the manual-fine UI default). Returns the number of fines issued. Used by the
     * "evaluate now" button so a demo records fines immediately.
     */
    @Transactional
    public int autoFineBreaches(String issuedBy) {
        Set<Long> finedAlertIds = new HashSet<>();
        for (Fine f : fineRepository.findAll()) {
            if (f.getAlertId() != null) finedAlertIds.add(f.getAlertId());
        }

        int issued = 0;
        for (PmAlert a : alertRepository.findAllByOrderByTriggeredAtDesc()) {
            if (!"BREACHED".equalsIgnoreCase(a.getAlertLevel())) continue;   // never fine WARNINGs
            if (finedAlertIds.contains(a.getId())) continue;                 // already fined

            BigDecimal over = (a.getMeasuredValue() != null && a.getThresholdValue() != null)
                    ? a.getMeasuredValue().subtract(a.getThresholdValue())
                    : BigDecimal.ZERO;
            long scaled = Math.max(0L, Math.round(over.doubleValue())) * 100L;
            BigDecimal amount = BigDecimal.valueOf(Math.max(scaled, 1000L));
            String reason = String.format(
                    "Auto-issued on evaluation: %s breach of %s µg/m³ vs %s threshold%s.",
                    a.getPmType() == null ? "PM" : a.getPmType().toUpperCase(),
                    a.getMeasuredValue(), a.getThresholdValue(),
                    a.getAlertDate() != null ? " for " + a.getAlertDate() : "");

            ImposeFineRequest req = new ImposeFineRequest();
            req.setAmount(amount);
            req.setReason(reason);
            try {
                imposeFine(a.getId(), req, issuedBy);
                issued++;
            } catch (IllegalStateException ignored) {
                // Concurrently fined between our scan and the insert — skip it.
            }
        }
        return issued;
    }

    // --- mapping helpers ---

    private CompanySite findSite(Long siteId) {
        if (siteId == null) return null;
        return siteRepository.findById(siteId.intValue()).orElse(null);
    }

    private PmAlertResponse toAlertResponse(PmAlert a, boolean fined) {
        PmAlertResponse r = new PmAlertResponse();
        r.setId(a.getId());
        r.setSiteId(a.getSiteId());
        r.setPmType(a.getPmType());
        r.setMeasuredValue(a.getMeasuredValue());
        r.setThresholdValue(a.getThresholdValue());
        r.setAlertLevel(a.getAlertLevel());
        r.setAlertDate(a.getAlertDate());
        r.setTriggeredAt(a.getTriggeredAt());
        r.setResolvedAt(a.getResolvedAt());
        r.setNote(a.getNote());
        r.setFined(fined);
        CompanySite site = findSite(a.getSiteId());
        if (site != null) {
            r.setSiteName(site.getSiteName());
            Company c = site.getCompany();
            if (c != null) {
                r.setCompanyId(c.getId());
                r.setCompanyName(c.getCompanyName());
            }
        }
        return r;
    }

    private FineResponse toFineResponse(Fine f) {
        FineResponse r = new FineResponse();
        r.setId(f.getId());
        r.setAlertId(f.getAlertId());
        r.setSiteId(f.getSiteId());
        r.setCompanyId(f.getCompanyId());
        r.setAmount(f.getAmount());
        r.setReason(f.getReason());
        r.setStatus(f.getStatus());
        r.setIssuedBy(f.getIssuedBy());
        r.setIssuedAt(f.getIssuedAt());
        CompanySite site = findSite(f.getSiteId());
        if (site != null) {
            r.setSiteName(site.getSiteName());
            if (r.getCompanyName() == null && site.getCompany() != null) {
                r.setCompanyName(site.getCompany().getCompanyName());
            }
        }
        return r;
    }
}
