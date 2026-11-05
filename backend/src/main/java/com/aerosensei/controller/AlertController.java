package com.aerosensei.controller;

import com.aerosensei.dto.FineResponse;
import com.aerosensei.dto.ImposeFineRequest;
import com.aerosensei.dto.PmAlertResponse;
import com.aerosensei.service.AlertService;
import com.aerosensei.service.PmAlertSchedulerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Government oversight of PM-breach alerts and the fines raised against them.
 * All endpoints are restricted to GOVERNMENT/ADMIN via method security.
 */
@RestController
@RequestMapping("/api/alerts")
@PreAuthorize("hasAnyRole('GOVERNMENT','ADMIN')")
public class AlertController {

    @Autowired
    private AlertService alertService;

    @Autowired
    private PmAlertSchedulerService pmAlertSchedulerService;

    /** GET /api/alerts — all PM-breach alerts, newest first. */
    @GetMapping
    public ResponseEntity<List<PmAlertResponse>> listAlerts() {
        return ResponseEntity.ok(alertService.listAlerts());
    }

    /** GET /api/alerts/fines — all issued fines, newest first. */
    @GetMapping("/fines")
    public ResponseEntity<List<FineResponse>> listFines() {
        return ResponseEntity.ok(alertService.listFines());
    }

    /** GET /api/alerts/my — breach alerts for the authenticated company's own sites. */
    @GetMapping("/my")
    @PreAuthorize("hasAnyRole('COMPANY','GOVERNMENT','ADMIN')")
    public ResponseEntity<List<PmAlertResponse>> myAlerts(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(alertService.listAlertsForCompany(email));
    }

    /** GET /api/alerts/fines/my — fines issued against the authenticated company. */
    @GetMapping("/fines/my")
    @PreAuthorize("hasAnyRole('COMPANY','GOVERNMENT','ADMIN')")
    public ResponseEntity<List<FineResponse>> myFines(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(alertService.listFinesForCompany(email));
    }

    /**
     * POST /api/alerts/evaluate-now — demo: run the daily PM evaluation for the
     * current day immediately (writing breach/warning rows for today) and auto-issue
     * fines for every BREACHED, un-fined alert. Returns how many of each were created.
     */
    @PostMapping("/evaluate-now")
    public ResponseEntity<?> evaluateNow(@AuthenticationPrincipal String email) {
        int alertsWritten = pmAlertSchedulerService.evaluateNow();
        int finesIssued = alertService.autoFineBreaches(email);
        return ResponseEntity.ok(Map.of("alertsWritten", alertsWritten, "finesIssued", finesIssued));
    }

    /** POST /api/alerts/{alertId}/fine — impose a fine against a breach alert. */
    @PostMapping("/{alertId}/fine")
    public ResponseEntity<?> imposeFine(@PathVariable Long alertId,
                                        @RequestBody ImposeFineRequest req,
                                        @AuthenticationPrincipal String email) {
        try {
            FineResponse fine = alertService.imposeFine(alertId, req, email);
            return ResponseEntity.status(HttpStatus.CREATED).body(fine);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
        }
    }
}
