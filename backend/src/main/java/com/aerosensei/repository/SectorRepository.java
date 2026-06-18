package com.aerosensei.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

import com.aerosensei.entity.Sector;

@Repository
public interface SectorRepository extends JpaRepository<Sector, Long> {
    Optional<Sector> findByName(String name);
}
