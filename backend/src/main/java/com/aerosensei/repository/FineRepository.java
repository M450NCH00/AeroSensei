package com.aerosensei.repository;

import com.aerosensei.entity.Fine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FineRepository extends JpaRepository<Fine, Long> {
    List<Fine> findAllByOrderByIssuedAtDesc();
    List<Fine> findByAlertId(Long alertId);
    List<Fine> findByCompanyIdOrderByIssuedAtDesc(Long companyId);
}
