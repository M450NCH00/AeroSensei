package com.aerosensei.service;

import com.aerosensei.dto.FineResponse;
import com.aerosensei.dto.ImposeFineRequest;
import com.aerosensei.dto.PmAlertResponse;
import com.aerosensei.entity.Company;
import com.aerosensei.entity.CompanySite;
import com.aerosensei.entity.Fine;
import com.aerosensei.entity.PmAlert;
import com.aerosensei.entity.SensorRegistry;
import com.aerosensei.repository.FineRepository;
import com.aerosensei.repository.PmAlertRepository;
import com.aerosensei.repository.SensorRegistryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Government-facing service over PM-breach alerts and the fines raised against
 * them. Enriches alerts with the owning company (resolved through the sensor
 * registry) so a regulator can see who to penalize.
 */
@Service
public class AlertService {

    @Autowired
    private PmAlertRepository alertRepository;

    @Autowired
    private FineRepository fineRepository;

    @Autowired
    private SensorRegistryRepository sensorRepository;

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

    /**
     * Impose a fine against an alert. Resolves the offending company from the
     * alert's sensor and denormalizes it onto the fine.
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

        SensorRegistry sensor = sensorRepository.findBySensorId(alert.getSensorId()).orElse(null);
        CompanySite site = sensor != null ? sensor.getSite() : null;
        Company company = site != null ? site.getCompany() : null;

        Fine fine = new Fine();
        fine.setAlertId(alert.getId());
        fine.setSensorId(alert.getSensorId());
        fine.setCompanyId(company != null ? company.getId() : null);
        fine.setAmount(req.getAmount());
        fine.setReason(req.getReason());
        fine.setStatus("issued");
        fine.setIssuedBy(issuedBy);

        return toFineResponse(fineRepository.save(fine));
    }

    // --- mapping helpers ---

    private PmAlertResponse toAlertResponse(PmAlert a, boolean fined) {
        PmAlertResponse r = new PmAlertResponse();
        r.setId(a.getId());
        r.setSensorId(a.getSensorId());
        r.setPmType(a.getPmType());
        r.setMeasuredValue(a.getMeasuredValue());
        r.setThresholdValue(a.getThresholdValue());
        r.setAlertLevel(a.getAlertLevel());
        r.setTriggeredAt(a.getTriggeredAt());
        r.setResolvedAt(a.getResolvedAt());
        r.setNote(a.getNote());
        r.setFined(fined);
        Optional<SensorRegistry> sensor = a.getSensorId() == null
                ? Optional.empty()
                : sensorRepository.findBySensorId(a.getSensorId());
        sensor.ifPresent(s -> {
            CompanySite site = s.getSite();
            if (site != null) {
                r.setLocationName(site.getSiteName());
                Company c = site.getCompany();
                if (c != null) {
                    r.setCompanyId(c.getId());
                    r.setCompanyName(c.getCompanyName());
                }
            }
        });
        return r;
    }

    private FineResponse toFineResponse(Fine f) {
        FineResponse r = new FineResponse();
        r.setId(f.getId());
        r.setAlertId(f.getAlertId());
        r.setSensorId(f.getSensorId());
        r.setCompanyId(f.getCompanyId());
        r.setAmount(f.getAmount());
        r.setReason(f.getReason());
        r.setStatus(f.getStatus());
        r.setIssuedBy(f.getIssuedBy());
        r.setIssuedAt(f.getIssuedAt());
        if (f.getSensorId() != null) {
            sensorRepository.findBySensorId(f.getSensorId()).ifPresent(s -> {
                CompanySite site = s.getSite();
                if (site != null) {
                    r.setLocationName(site.getSiteName());
                    if (r.getCompanyName() == null && site.getCompany() != null) {
                        r.setCompanyName(site.getCompany().getCompanyName());
                    }
                }
            });
        }
        return r;
    }
}
