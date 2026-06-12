package com.aerosensei.repository;

import com.aerosensei.entity.CarbonTransaction;
import com.aerosensei.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CarbonTransactionRepository extends JpaRepository<CarbonTransaction, Long> {
    List<CarbonTransaction> findByFromCompanyOrToCompanyOrderByCreatedAtDesc(Company from, Company to);
    Optional<CarbonTransaction> findTopByOrderByCreatedAtDesc();
    List<CarbonTransaction> findAllByOrderByCreatedAtAsc();
    List<CarbonTransaction> findByCreatedAtAfterOrderByCreatedAtAsc(java.time.LocalDateTime after);
}
