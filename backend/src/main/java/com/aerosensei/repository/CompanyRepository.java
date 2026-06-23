package com.aerosensei.repository;

import com.aerosensei.entity.Company;
import com.aerosensei.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CompanyRepository extends JpaRepository<Company, Long> {
    Optional<Company> findByUser(User user);
    Optional<Company> findByUser_Email(String email);

    // ==========================================
    // SECURITY OWNERSHIP CHECKS
    // ==========================================

    // Checks if a Company belongs to a specific user
    @Query(value = "SELECT EXISTS (SELECT 1 FROM companies c " +
            "JOIN users u ON c.user_id = u.id " +
            "WHERE c.id = :companyId AND u.email = :email)", nativeQuery = true)
    boolean existsByCompanyIdAndUserEmail(@Param("companyId") Integer companyId, @Param("email") String email);

}
