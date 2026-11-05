package com.aerosensei.repository;

import com.aerosensei.entity.ComplianceCycle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ComplianceCycleRepository extends JpaRepository<ComplianceCycle, Long> {
    Optional<ComplianceCycle> findByYear(Integer year);
    List<ComplianceCycle> findAllByOrderByYearDesc();
}
