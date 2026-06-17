package com.aerosensei.service;

import com.aerosensei.dto.AllocationResponse;
import com.aerosensei.dto.ComplianceCycleResponse;
import com.aerosensei.dto.CompliancePositionResponse;
import com.aerosensei.dto.EmissionReportRequest;
import com.aerosensei.dto.EmissionReportResponse;
import com.aerosensei.entity.CarbonAllocation;
import com.aerosensei.entity.Company;
import com.aerosensei.entity.ComplianceCycle;
import com.aerosensei.entity.EmissionReport;
import com.aerosensei.repository.CarbonAllocationRepository;
import com.aerosensei.repository.CompanyRepository;
import com.aerosensei.repository.ComplianceCycleRepository;
import com.aerosensei.repository.EmissionReportRepository;
import com.aerosensei.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AllocationService {

    // ── Compliance phases ─────────────────────────────────────────────────────
    private static final String PHASE_PENDING       = "PENDING";
    private static final String PHASE_PRE_ALLOCATED = "PRE_ALLOCATED";
    private static final String PHASE_MIDYEAR_OPEN  = "MIDYEAR_OPEN";
    private static final String PHASE_FINAL_OPEN    = "FINAL_OPEN";
    private static final String PHASE_ALLOCATED     = "ALLOCATED";
    private static final String PHASE_SETTLED       = "SETTLED";

    private static final String REPORT_MIDYEAR = "MIDYEAR";
    private static final String REPORT_FINAL   = "FINAL";

    // Pre-allocation: 70% of the previous year's verified emissions.
    private static final BigDecimal PRE_ALLOCATION_RATE = new BigDecimal("0.70");

    // Plain instance — ObjectMapper is thread-safe and not always exposed as a bean.
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private final EmissionReportRepository reportRepo;
    private final CarbonAllocationRepository allocationRepo;
    private final CompanyRepository companyRepo;
    private final ComplianceCycleRepository cycleRepo;
    private final UserRepository userRepo;
    private final SectorService sectorService;

    public AllocationService(EmissionReportRepository reportRepo,
                             CarbonAllocationRepository allocationRepo,
                             CompanyRepository companyRepo,
                             ComplianceCycleRepository cycleRepo,
                             UserRepository userRepo,
                             SectorService sectorService) {
        this.reportRepo = reportRepo;
        this.allocationRepo = allocationRepo;
        this.companyRepo = companyRepo;
        this.cycleRepo = cycleRepo;
        this.userRepo = userRepo;
        this.sectorService = sectorService;
    }

    // ── Emission reports ──────────────────────────────────────────────────────

    @Transactional
    public EmissionReportResponse submitReport(String email, EmissionReportRequest req) {
        Company company = companyRepo.findByUser_Email(email)
                .orElseThrow(() -> new IllegalStateException("No company found for user: " + email));

        String reportType = normalizeReportType(req.getReportType());

        // Reporting is only open in the matching phase of the compliance cycle.
        ComplianceCycle cycle = cycleRepo.findByYear(req.getYear()).orElse(null);
        String phase = cycle != null ? cycle.getPhase() : PHASE_PENDING;
        if (REPORT_MIDYEAR.equals(reportType) && !PHASE_MIDYEAR_OPEN.equals(phase)) {
            throw new IllegalStateException("Mid-year reporting is not open for " + req.getYear()
                    + " (current phase: " + phase + ").");
        }
        if (REPORT_FINAL.equals(reportType) && !PHASE_FINAL_OPEN.equals(phase)) {
            throw new IllegalStateException("Final reporting is not open for " + req.getYear()
                    + " (current phase: " + phase + ").");
        }

        EmissionReport report = reportRepo
                .findByCompanyIdAndYearAndReportType(company.getId(), req.getYear(), reportType)
                .orElseGet(() -> {
                    EmissionReport r = new EmissionReport();
                    r.setCompany(company);
                    r.setYear(req.getYear());
                    r.setReportType(reportType);
                    return r;
                });

        Map<String, Object> params = req.getParameters();
        if (params != null && !params.isEmpty() && company.getSector() != null) {
            // Derive the totals from the company's sector formulas.
            Long sectorId = company.getSector().getId();
            double emissions = sectorService.evaluateFormula(sectorId, params);
            Double activity = sectorService.evaluateActivityFormula(sectorId, params);
            if (activity == null) {
                throw new IllegalStateException(
                        "Sector '" + company.getSector().getName() + "' has no activity formula defined.");
            }
            report.setVerifiedEmissions(BigDecimal.valueOf(emissions).setScale(4, RoundingMode.HALF_UP));
            report.setActivityLevel(BigDecimal.valueOf(activity).setScale(4, RoundingMode.HALF_UP));
            report.setParameters(writeParams(params));
        } else {
            // Fallback: company submitted the totals directly (no sector formulas).
            if (req.getActivityLevel() == null || req.getVerifiedEmissions() == null) {
                throw new IllegalArgumentException(
                        "Provide either sector parameters or both activityLevel and verifiedEmissions.");
            }
            report.setActivityLevel(req.getActivityLevel());
            report.setVerifiedEmissions(req.getVerifiedEmissions());
            report.setParameters(null);
        }
        report.setSubmittedAt(LocalDateTime.now());
        report = reportRepo.save(report);
        return toReportResponse(report);
    }

    private String writeParams(Map<String, Object> params) {
        try {
            return objectMapper.writeValueAsString(params);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid parameters: " + e.getMessage());
        }
    }

    private Map<String, Object> readParams(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    @Transactional(readOnly = true)
    public List<EmissionReportResponse> getMyReports(String email) {
        Company company = companyRepo.findByUser_Email(email)
                .orElseThrow(() -> new IllegalStateException("No company found for user: " + email));
        return reportRepo.findByCompanyId(company.getId()).stream()
                .map(this::toReportResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<EmissionReportResponse> getAllReports(Integer year) {
        return reportRepo.findByYear(year).stream()
                .map(this::toReportResponse)
                .collect(Collectors.toList());
    }

    // ── Compliance cycle: phase transitions (government actions) ───────────────

    /**
     * Step 1 — Pre-allocation. Grants every company 70% of its previous year's
     * verified emissions as allowances (free, up front, for liquidity).
     */
    @Transactional
    public ComplianceCycleResponse preAllocate(Integer year) {
        ComplianceCycle cycle = getOrCreateCycle(year);
        requirePhase(cycle, PHASE_PENDING, "pre-allocate");

        for (Company company : companyRepo.findAll()) {
            BigDecimal prior = reportRepo
                    .findByCompanyIdAndYearAndReportType(company.getId(), year - 1, REPORT_FINAL)
                    .map(EmissionReport::getVerifiedEmissions)
                    .orElse(BigDecimal.ZERO);
            BigDecimal grant = prior.multiply(PRE_ALLOCATION_RATE).setScale(4, RoundingMode.HALF_UP);

            adjustCredits(company, grant);
            companyRepo.save(company);

            CarbonAllocation alloc = findAllocation(company.getId(), year)
                    .orElseGet(() -> {
                        CarbonAllocation a = new CarbonAllocation();
                        a.setCompany(company);
                        a.setYear(year);
                        return a;
                    });
            alloc.setPreAllocation(grant);
            alloc.setStatus(PHASE_PRE_ALLOCATED);
            alloc.setAllocatedAt(LocalDateTime.now());
            allocationRepo.save(alloc);
        }

        cycle.setPhase(PHASE_PRE_ALLOCATED);
        cycle.setPreAllocatedAt(LocalDateTime.now());
        return saveCycle(cycle);
    }

    /** Step 2 — Open mid-year MRV reporting. */
    @Transactional
    public ComplianceCycleResponse openMidyear(Integer year) {
        ComplianceCycle cycle = getOrCreateCycle(year);
        requirePhase(cycle, PHASE_PRE_ALLOCATED, "open mid-year reporting");
        cycle.setPhase(PHASE_MIDYEAR_OPEN);
        cycle.setMidyearOpenedAt(LocalDateTime.now());
        return saveCycle(cycle);
    }

    /** Step 3 — Open final (full-year) reporting. */
    @Transactional
    public ComplianceCycleResponse openFinal(Integer year) {
        ComplianceCycle cycle = getOrCreateCycle(year);
        requirePhase(cycle, PHASE_MIDYEAR_OPEN, "open final reporting");
        cycle.setPhase(PHASE_FINAL_OPEN);
        cycle.setFinalOpenedAt(LocalDateTime.now());
        return saveCycle(cycle);
    }

    /**
     * Step 4 — Final allocation. Runs the sector benchmark + deviation formula
     * over the FINAL reports and adjusts each company's credits by
     * (final allocation − pre-allocation).
     */
    @Transactional
    public ComplianceCycleResponse finalizeAllocations(Integer year) {
        ComplianceCycle cycle = getOrCreateCycle(year);
        requirePhase(cycle, PHASE_FINAL_OPEN, "finalize allocation");

        List<EmissionReport> reports = reportRepo.findByYearAndReportType(year, REPORT_FINAL);
        if (reports.isEmpty()) {
            throw new IllegalStateException("No final emission reports found for year: " + year);
        }

        // Group reports by sector id (skip companies with no sector)
        Map<Long, List<EmissionReport>> bySector = reports.stream()
                .filter(r -> r.getCompany().getSector() != null)
                .collect(Collectors.groupingBy(r -> r.getCompany().getSector().getId()));

        for (List<EmissionReport> sectorReports : bySector.values()) {
            // Sector benchmark = sum(emissions) / sum(activity)
            BigDecimal totalEmissions = sectorReports.stream()
                    .map(EmissionReport::getVerifiedEmissions)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalActivity = sectorReports.stream()
                    .map(EmissionReport::getActivityLevel)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (totalActivity.compareTo(BigDecimal.ZERO) == 0) continue;

            BigDecimal benchmark = totalEmissions.divide(totalActivity, 10, RoundingMode.HALF_UP);

            for (EmissionReport r : sectorReports) {
                Company company = r.getCompany();
                BigDecimal emissions = r.getVerifiedEmissions();
                BigDecimal activity = r.getActivityLevel();
                if (activity.compareTo(BigDecimal.ZERO) == 0) continue;

                BigDecimal intensity = emissions.divide(activity, 10, RoundingMode.HALF_UP);
                BigDecimal deviation = intensity.subtract(benchmark)
                        .divide(benchmark, 10, RoundingMode.HALF_UP);

                BigDecimal allocationAmount;
                BigDecimal absDeviation = deviation.abs();
                if (absDeviation.compareTo(new BigDecimal("0.20")) <= 0) {
                    // allocation = emissions * (1 - deviation * 0.15)
                    BigDecimal factor = BigDecimal.ONE.subtract(deviation.multiply(new BigDecimal("0.15")));
                    allocationAmount = emissions.multiply(factor).setScale(4, RoundingMode.HALF_UP);
                } else if (deviation.compareTo(new BigDecimal("0.20")) > 0) {
                    allocationAmount = emissions.multiply(new BigDecimal("0.97")).setScale(4, RoundingMode.HALF_UP);
                } else {
                    allocationAmount = emissions.multiply(new BigDecimal("1.03")).setScale(4, RoundingMode.HALF_UP);
                }

                CarbonAllocation alloc = findAllocation(company.getId(), year)
                        .orElseGet(() -> {
                            CarbonAllocation a = new CarbonAllocation();
                            a.setCompany(company);
                            a.setYear(year);
                            a.setPreAllocation(BigDecimal.ZERO);
                            return a;
                        });

                BigDecimal pre = alloc.getPreAllocation() != null ? alloc.getPreAllocation() : BigDecimal.ZERO;
                // Adjust the company's credits by the difference between the final
                // allocation and what was granted up front.
                BigDecimal delta = allocationAmount.subtract(pre);
                adjustCredits(company, delta);
                companyRepo.save(company);

                // The year's surplus/deficit is the company's own efficiency vs the
                // benchmark: allowances allocated for the year minus what it emitted.
                // Allocated more than emitted -> surplus (efficient); less -> deficit.
                BigDecimal surplusDeficit = allocationAmount.subtract(emissions)
                        .setScale(4, RoundingMode.HALF_UP);

                alloc.setVerifiedEmissions(emissions);
                alloc.setActivityLevel(activity);
                alloc.setIntensity(intensity.setScale(6, RoundingMode.HALF_UP));
                alloc.setBenchmarkIntensity(benchmark.setScale(6, RoundingMode.HALF_UP));
                alloc.setDeviationPct(deviation.multiply(new BigDecimal("100")).setScale(4, RoundingMode.HALF_UP));
                alloc.setAllocationAmount(allocationAmount);
                alloc.setSurplusDeficit(surplusDeficit);
                alloc.setStatus(PHASE_ALLOCATED);
                alloc.setAllocatedAt(LocalDateTime.now());
                allocationRepo.save(alloc);
            }
        }

        cycle.setPhase(PHASE_ALLOCATED);
        cycle.setAllocatedAt(LocalDateTime.now());
        return saveCycle(cycle);
    }

    /**
     * Step 5 — Settle & deduct. Each company's real (verified) emissions are
     * deducted from its balance. Credits do NOT expire: any remaining surplus
     * stays on the balance and carries forward into the next compliance year.
     */
    @Transactional
    public ComplianceCycleResponse settle(Integer year) {
        ComplianceCycle cycle = getOrCreateCycle(year);
        requirePhase(cycle, PHASE_ALLOCATED, "settle");

        for (CarbonAllocation alloc : allocationRepo.findByYear(year)) {
            Company company = alloc.getCompany();
            BigDecimal emissions = alloc.getVerifiedEmissions() != null
                    ? alloc.getVerifiedEmissions() : BigDecimal.ZERO;

            // Deduct the real emissions from the balance; surplus carries forward.
            BigDecimal deducted = emissions.min(company.getCarbonCredits()).max(BigDecimal.ZERO);
            company.setCarbonCredits(company.getCarbonCredits().subtract(deducted));
            companyRepo.save(company);

            alloc.setSurrenderedAmount(deducted);
            alloc.setStatus(PHASE_SETTLED);
            allocationRepo.save(alloc);
        }

        cycle.setPhase(PHASE_SETTLED);
        cycle.setSettledAt(LocalDateTime.now());
        return saveCycle(cycle);
    }

    // ── Reads ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ComplianceCycleResponse getCycle(Integer year) {
        ComplianceCycle cycle = cycleRepo.findByYear(year)
                .orElseGet(() -> {
                    ComplianceCycle c = new ComplianceCycle();
                    c.setYear(year);
                    c.setPhase(PHASE_PENDING);
                    return c;
                });
        return toCycleResponse(cycle);
    }

    @Transactional(readOnly = true)
    public List<ComplianceCycleResponse> getCycles() {
        return cycleRepo.findAllByOrderByYearDesc().stream()
                .map(this::toCycleResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AllocationResponse> getAllocations(Integer year) {
        return allocationRepo.findByYear(year).stream()
                .map(this::toAllocationResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AllocationResponse> getMyAllocations(String email) {
        Company company = companyRepo.findByUser_Email(email)
                .orElseThrow(() -> new IllegalStateException("No company found for user: " + email));
        return allocationRepo.findByCompanyId(company.getId()).stream()
                .map(this::toAllocationResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CompliancePositionResponse getMyPosition(String email, Integer year) {
        Company company = companyRepo.findByUser_Email(email)
                .orElseThrow(() -> new IllegalStateException("No company found for user: " + email));

        String phase = cycleRepo.findByYear(year).map(ComplianceCycle::getPhase).orElse(PHASE_PENDING);

        CarbonAllocation alloc = findAllocation(company.getId(), year).orElse(null);
        BigDecimal pre = alloc != null ? alloc.getPreAllocation() : null;
        BigDecimal finalAlloc = alloc != null ? alloc.getAllocationAmount() : null;
        String status = alloc != null ? alloc.getStatus() : null;

        // Verified emissions: from the ledger once finalized, else from a FINAL report.
        BigDecimal verified = alloc != null ? alloc.getVerifiedEmissions() : null;
        if (verified == null) {
            verified = reportRepo.findByCompanyIdAndYearAndReportType(company.getId(), year, REPORT_FINAL)
                    .map(EmissionReport::getVerifiedEmissions)
                    .orElse(null);
        }

        BigDecimal total = company.getCarbonCredits();
        // Year surplus/deficit = final allocation - verified emissions (efficiency),
        // taken straight from the ledger once the year is allocated.
        BigDecimal surplusDeficit = alloc != null ? alloc.getSurplusDeficit() : null;

        return new CompliancePositionResponse(
                company.getId(), year, phase, status,
                pre, finalAlloc, verified, total, surplusDeficit);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String normalizeReportType(String raw) {
        if (raw == null) return REPORT_FINAL;
        String t = raw.trim().toUpperCase();
        if (!REPORT_MIDYEAR.equals(t) && !REPORT_FINAL.equals(t)) {
            throw new IllegalArgumentException("Invalid report type: " + raw);
        }
        return t;
    }

    /** Add (or, if negative, remove) credits. Balance never goes below zero. */
    private void adjustCredits(Company company, BigDecimal delta) {
        BigDecimal credits = company.getCarbonCredits() != null ? company.getCarbonCredits() : BigDecimal.ZERO;
        company.setCarbonCredits(credits.add(delta).max(BigDecimal.ZERO));
    }

    private Optional<CarbonAllocation> findAllocation(Long companyId, Integer year) {
        return allocationRepo.findByCompanyId(companyId).stream()
                .filter(a -> a.getYear().equals(year))
                .findFirst();
    }

    private ComplianceCycle getOrCreateCycle(Integer year) {
        return cycleRepo.findByYear(year).orElseGet(() -> {
            ComplianceCycle c = new ComplianceCycle();
            c.setYear(year);
            c.setPhase(PHASE_PENDING);
            return c;
        });
    }

    private void requirePhase(ComplianceCycle cycle, String expected, String action) {
        if (!expected.equals(cycle.getPhase())) {
            throw new IllegalStateException("Cannot " + action + " for " + cycle.getYear()
                    + ": compliance cycle is in phase " + cycle.getPhase()
                    + " (expected " + expected + ").");
        }
    }

    private ComplianceCycleResponse saveCycle(ComplianceCycle cycle) {
        cycle.setUpdatedAt(LocalDateTime.now());
        return toCycleResponse(cycleRepo.save(cycle));
    }

    private EmissionReportResponse toReportResponse(EmissionReport r) {
        Company company = r.getCompany();
        String sectorName = company.getSector() != null ? company.getSector().getName() : null;
        return new EmissionReportResponse(
                r.getId(),
                company.getId(),
                company.getCompanyName(),
                sectorName,
                r.getYear(),
                r.getReportType(),
                r.getActivityLevel(),
                r.getVerifiedEmissions(),
                readParams(r.getParameters()),
                r.getSubmittedAt()
        );
    }

    private AllocationResponse toAllocationResponse(CarbonAllocation a) {
        Company company = a.getCompany();
        String sectorName = company.getSector() != null ? company.getSector().getName() : null;
        return new AllocationResponse(
                a.getId(),
                company.getId(),
                company.getCompanyName(),
                sectorName,
                a.getYear(),
                a.getPreAllocation(),
                a.getVerifiedEmissions(),
                a.getActivityLevel(),
                a.getIntensity(),
                a.getBenchmarkIntensity(),
                a.getDeviationPct(),
                a.getAllocationAmount(),
                a.getSurplusDeficit(),
                a.getStatus(),
                a.getAllocatedAt()
        );
    }

    private ComplianceCycleResponse toCycleResponse(ComplianceCycle c) {
        return new ComplianceCycleResponse(
                c.getYear(),
                c.getPhase(),
                c.getPreAllocatedAt(),
                c.getMidyearOpenedAt(),
                c.getFinalOpenedAt(),
                c.getAllocatedAt(),
                c.getSettledAt()
        );
    }
}
