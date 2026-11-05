package com.aerosensei.repository;

import com.aerosensei.entity.EmissionReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmissionReportRepository extends JpaRepository<EmissionReport, Long> {
    List<EmissionReport> findByYear(Integer year);
    Optional<EmissionReport> findByCompanyIdAndYear(Long companyId, Integer year);
    List<EmissionReport> findByCompanyId(Long companyId);

    List<EmissionReport> findByYearAndReportType(Integer year, String reportType);
    Optional<EmissionReport> findByCompanyIdAndYearAndReportType(Long companyId, Integer year, String reportType);
}
