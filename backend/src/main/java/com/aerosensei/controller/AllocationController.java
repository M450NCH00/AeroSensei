package com.aerosensei.controller;

import com.aerosensei.dto.AllocationResponse;
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

    /**
     * Government triggers China ETS allocation calculation for a year.
     */
    @PostMapping("/calculate/{year}")
    @PreAuthorize("hasAnyRole('GOVERNMENT', 'ADMIN')")
    public ResponseEntity<List<AllocationResponse>> calculateAllocations(
            @PathVariable Integer year) {
        List<AllocationResponse> results = allocationService.calculateAllocations(year);
        return ResponseEntity.ok(results);
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
}
