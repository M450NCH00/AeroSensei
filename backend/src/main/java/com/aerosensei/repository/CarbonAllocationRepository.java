package com.aerosensei.repository;

import com.aerosensei.entity.CarbonAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CarbonAllocationRepository extends JpaRepository<CarbonAllocation, Long> {
    List<CarbonAllocation> findByYear(Integer year);
    List<CarbonAllocation> findByCompanyId(Long companyId);
    boolean existsByYear(Integer year);
}
