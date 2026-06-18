package com.aerosensei.repository;

import com.aerosensei.entity.CompanySite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CompanySiteRepository extends JpaRepository<CompanySite, Integer> {
    // Spring Boot automatically translates this method name into a SQL query
    List<CompanySite> findByCompanyId(Integer companyId);
}