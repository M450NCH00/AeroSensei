package com.aerosensei.controller;

import com.aerosensei.dto.AllocationResponse;
import com.aerosensei.dto.ComplianceCycleResponse;
import com.aerosensei.dto.CompliancePositionResponse;
import com.aerosensei.dto.EmissionReportRequest;
import com.aerosensei.dto.EmissionReportResponse;
import com.aerosensei.service.AllocationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/allocations")
public class AllocationController {

    private final AllocationService allocationService;

    public AllocationController(AllocationService allocationService) {
        this.allocationService = allocationService;
    }

    /**
     * Company submits their emission report for a given year.
     */
    @PostMapping("/report")
    public ResponseEntity<EmissionReportResponse> submitReport(
            @AuthenticationPrincipal String email,
            @RequestBody EmissionReportRequest req) {
        EmissionReportResponse response = allocationService.submitReport(email, req);
        return ResponseEntity.ok(response);
    }

    /**
     * Company views their own submitted reports.
     */
    @GetMapping("/report/my")
    public ResponseEntity<List<EmissionReportResponse>> getMyReports(
            @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(allocationService.getMyReports(email));
    }

    /**
     * Government views all submitted reports for a given year.
     */
    @GetMapping("/reports/{year}")
    @PreAuthorize("hasAnyRole('GOVERNMENT', 'ADMIN')")
    public ResponseEntity<List<EmissionReportResponse>> getAllReports(
            @PathVariable Integer year) {
        return ResponseEntity.ok(allocationService.getAllReports(year));
    }

    // ── Compliance cycle phase transitions (government actions) ───────────────

    /** Step 1 — Pre-allocate 70% of prior-year emissions to every company. */
    @PostMapping("/cycle/{year}/pre-allocate")
    @PreAuthorize("hasAnyRole('GOVERNMENT', 'ADMIN')")
    public ResponseEntity<ComplianceCycleResponse> preAllocate(@PathVariable Integer year) {
        return ResponseEntity.ok(allocationService.preAllocate(year));
    }

    /** Step 2 — Open mid-year MRV reporting. */
    @PostMapping("/cycle/{year}/open-midyear")
    @PreAuthorize("hasAnyRole('GOVERNMENT', 'ADMIN')")
    public ResponseEntity<ComplianceCycleResponse> openMidyear(@PathVariable Integer year) {
        return ResponseEntity.ok(allocationService.openMidyear(year));
    }

    /** Step 3 — Open final (full-year) reporting. */
    @PostMapping("/cycle/{year}/open-final")
    @PreAuthorize("hasAnyRole('GOVERNMENT', 'ADMIN')")
    public ResponseEntity<ComplianceCycleResponse> openFinal(@PathVariable Integer year) {
        return ResponseEntity.ok(allocationService.openFinal(year));
    }

    /** Step 4 — Run the final allocation formula and adjust credits. */
    @PostMapping("/cycle/{year}/finalize")
    @PreAuthorize("hasAnyRole('GOVERNMENT', 'ADMIN')")
    public ResponseEntity<ComplianceCycleResponse> finalizeAllocations(@PathVariable Integer year) {
        return ResponseEntity.ok(allocationService.finalizeAllocations(year));
    }

    /** Step 5 — Deduct real emissions from balances; surplus carries forward. */
    @PostMapping("/cycle/{year}/settle")
    @PreAuthorize("hasAnyRole('GOVERNMENT', 'ADMIN')")
    public ResponseEntity<ComplianceCycleResponse> settle(@PathVariable Integer year) {
        return ResponseEntity.ok(allocationService.settle(year));
    }

    /** Current phase of a given compliance year. */
    @GetMapping("/cycle/{year}")
    public ResponseEntity<ComplianceCycleResponse> getCycle(@PathVariable Integer year) {
        return ResponseEntity.ok(allocationService.getCycle(year));
    }

    /** All known compliance cycles, newest first. */
    @GetMapping("/cycles")
    public ResponseEntity<List<ComplianceCycleResponse>> getCycles() {
        return ResponseEntity.ok(allocationService.getCycles());
    }

    /**
     * Any authenticated user can view allocation results for a given year.
     */
    @GetMapping("/results/{year}")
    public ResponseEntity<List<AllocationResponse>> getAllocations(
            @PathVariable Integer year) {
        return ResponseEntity.ok(allocationService.getAllocations(year));
    }

    /**
     * Company views their own allocation history.
     */
    @GetMapping("/my")
    public ResponseEntity<List<AllocationResponse>> getMyAllocations(
            @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(allocationService.getMyAllocations(email));
    }

    /**
     * Company views its surplus/deficit position for a given year.
     */
    @GetMapping("/position/{year}")
    public ResponseEntity<CompliancePositionResponse> getMyPosition(
            @AuthenticationPrincipal String email,
            @PathVariable Integer year) {
        return ResponseEntity.ok(allocationService.getMyPosition(email, year));
    }
}
