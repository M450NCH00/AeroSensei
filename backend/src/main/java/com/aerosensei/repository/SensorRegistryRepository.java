package com.aerosensei.repository;

import com.aerosensei.entity.SensorRegistry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface SensorRegistryRepository extends JpaRepository<SensorRegistry, Long> {
    Optional<SensorRegistry> findBySensorId(String sensorId);

    // Used by the area finding function
    @Query("SELECT s FROM SensorRegistry s WHERE " +
            "s.latitude BETWEEN :minLat AND :maxLat AND " +
            "s.longitude BETWEEN :minLon AND :maxLon")
    List<SensorRegistry> findSensorsWithinBounds(
            @Param("minLat") BigDecimal minLat,
            @Param("maxLat") BigDecimal maxLat,
            @Param("minLon") BigDecimal minLon,
            @Param("maxLon") BigDecimal maxLon
    );

    List<SensorRegistry> findByLocationNameContainingIgnoreCase(String locationName);
}

