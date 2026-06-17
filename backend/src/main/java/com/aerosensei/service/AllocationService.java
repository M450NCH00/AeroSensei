package com.aerosensei.service;

import com.aerosensei.dto.AllocationResponse;
import com.aerosensei.dto.EmissionReportRequest;
import com.aerosensei.dto.EmissionReportResponse;
import com.aerosensei.entity.CarbonAllocation;
import com.aerosensei.entity.Company;
import com.aerosensei.entity.EmissionReport;
import com.aerosensei.repository.CarbonAllocationRepository;
import com.aerosensei.repository.CompanyRepository;
import com.aerosensei.repository.EmissionReportRepository;
import com.aerosensei.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AllocationService {

    private final EmissionReportRepository reportRepo;
    private final CarbonAllocationRepository allocationRepo;
    private final CompanyRepository companyRepo;
    private final UserRepository userRepo;

    public AllocationService(EmissionReportRepository reportRepo,
                             CarbonAllocationRepository allocationRepo,
                             CompanyRepository companyRepo,
                             UserRepository userRepo) {
        this.reportRepo = reportRepo;
        this.allocationRepo = allocationRepo;
        this.companyRepo = companyRepo;
        this.userRepo = userRepo;
    }

    @Transactional
    public EmissionReportResponse submitReport(String email, EmissionReportRequest req) {
        Company company = companyRepo.findByUser_Email(email)
                .orElseThrow(() -> new IllegalStateException("No company found for user: " + email));

        Optional<EmissionReport> existing = reportRepo.findByCompanyIdAndYear(company.getId(), req.getYear());
        EmissionReport report;
        if (existing.isPresent()) {
            report = existing.get();
            report.setActivityLevel(req.getActivityLevel());
            report.setVerifiedEmissions(req.getVerifiedEmissions());
            // Update submittedAt on re-submission
            report.setSubmittedAt(LocalDateTime.now());
        } else {
            report = new EmissionReport();
            report.setCompany(company);
            report.setYear(req.getYear());
            report.setActivityLevel(req.getActivityLevel());
            report.setVerifiedEmissions(req.getVerifiedEmissions());
        }
        report = reportRepo.save(report);
        return toReportResponse(report);
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

    @Transactional
    public List<AllocationResponse> calculateAllocations(Integer year) {
        // The government may allocate carbon credits only once per year. Re-running
        // would add the allocation amount to every company's balance a second time.
        if (allocationRepo.existsByYear(year)) {
            throw new IllegalStateException("Carbon credits have already been allocated for year: " + year);
        }

        List<EmissionReport> reports = reportRepo.findByYear(year);
        if (reports.isEmpty()) {
            throw new IllegalStateException("No emission reports found for year: " + year);
        }

        // Group reports by sector id (skip companies with no sector)
        Map<Long, List<EmissionReport>> bySector = reports.stream()
                .filter(r -> r.getCompany().getSector() != null)
                .collect(Collectors.groupingBy(r -> r.getCompany().getSector().getId()));

        List<AllocationResponse> results = new ArrayList<>();

        for (Map.Entry<Long, List<EmissionReport>> entry : bySector.entrySet()) {
            List<EmissionReport> sectorReports = entry.getValue();

            // Calculate sector benchmark = sum(emissions) / sum(activity)
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

                // deviation = (intensity - benchmark) / benchmark
                BigDecimal deviation = intensity.subtract(benchmark)
                        .divide(benchmark, 10, RoundingMode.HALF_UP);

                BigDecimal allocationAmount;
                BigDecimal absDeviation = deviation.abs();

                if (absDeviation.compareTo(new BigDecimal("0.20")) <= 0) {
                    // allocation = emissions * (1 - deviation * 0.15)
                    BigDecimal factor = BigDecimal.ONE.subtract(
                            deviation.multiply(new BigDecimal("0.15")));
                    allocationAmount = emissions.multiply(factor).setScale(4, RoundingMode.HALF_UP);
                } else if (deviation.compareTo(new BigDecimal("0.20")) > 0) {
                    // worst performers
                    allocationAmount = emissions.multiply(new BigDecimal("0.97")).setScale(4, RoundingMode.HALF_UP);
                } else {
                    // best performers (deviation < -0.20)
                    allocationAmount = emissions.multiply(new BigDecimal("1.03")).setScale(4, RoundingMode.HALF_UP);
                }

                // Create allocation record (guaranteed not to exist: allocation
                // runs at most once per year, enforced above).
                CarbonAllocation alloc = new CarbonAllocation();
                alloc.setCompany(company);
                alloc.setYear(year);
                alloc.setVerifiedEmissions(emissions);
                alloc.setActivityLevel(activity);
                alloc.setIntensity(intensity.setScale(6, RoundingMode.HALF_UP));
                alloc.setBenchmarkIntensity(benchmark.setScale(6, RoundingMode.HALF_UP));
                alloc.setDeviationPct(deviation.multiply(new BigDecimal("100")).setScale(4, RoundingMode.HALF_UP));
                alloc.setAllocationAmount(allocationAmount);
                alloc.setAllocatedAt(LocalDateTime.now());
                alloc = allocationRepo.save(alloc);

                // Add allocation to company's carbon credits balance
                BigDecimal currentCredits = company.getCarbonCredits() != null
                        ? company.getCarbonCredits() : BigDecimal.ZERO;
                company.setCarbonCredits(currentCredits.add(allocationAmount));
                companyRepo.save(company);

                results.add(toAllocationResponse(alloc));
            }
        }

        return results;
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

    // ── Helpers ──────────────────────────────────────────────────────────────

    private EmissionReportResponse toReportResponse(EmissionReport r) {
        Company company = r.getCompany();
        String sectorName = company.getSector() != null ? company.getSector().getName() : null;
        return new EmissionReportResponse(
                r.getId(),
                company.getId(),
                company.getCompanyName(),
                sectorName,
                r.getYear(),
                r.getActivityLevel(),
                r.getVerifiedEmissions(),
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
                a.getVerifiedEmissions(),
                a.getActivityLevel(),
                a.getIntensity(),
                a.getBenchmarkIntensity(),
                a.getDeviationPct(),
                a.getAllocationAmount(),
                a.getAllocatedAt()
        );
    }
}
