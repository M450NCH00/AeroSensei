package com.aerosensei.repository;

import com.aerosensei.entity.CompanySite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface CompanySiteRepository extends JpaRepository<CompanySite, Integer> {
    // Spring Boot automatically translates this method name into a SQL query
    List<CompanySite> findByCompanyId(Integer companyId);

    // Checks if a Site already exists by the Coordinates
    @Query(value = "SELECT EXISTS (SELECT 1 FROM company_sites cs " +
            "WHERE cs.latitude = :latitude AND cs.longitude = :longitude)", nativeQuery = true)
    boolean existsByCoordinates(@Param("latitude") BigDecimal latitude, @Param("longitude") BigDecimal longitude);
}