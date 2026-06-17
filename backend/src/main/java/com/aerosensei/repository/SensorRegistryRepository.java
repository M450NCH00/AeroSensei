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

    boolean existsBySensorId(String sensorId);

    Optional<SensorRegistry> deleteBySensorId(String sensorId);

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

    //use to fetch the sensors from the company of the user
    @Query(value = "SELECT c.company_name, cs.site_name, sr.sensor_id, sr.latitude, sr.longitude, sr.status " +
            "FROM sensor_registry sr " +
            "JOIN company_sites cs ON sr.site_id = cs.id " +
            "JOIN companies c ON cs.company_id = c.id " +
            "JOIN users u ON c.user_id = u.id " +
            "WHERE u.email = :email", nativeQuery = true)
    List<Object[]> findCompanySensorMetadataByEmail(@Param("email") String email);

    //use to fetch sensor by company and site name
    @Query(value = "SELECT c.company_name, cs.site_name, sr.sensor_id, sr.latitude, sr.longitude, sr.status " +
            "FROM sensor_registry sr " +
            "JOIN company_sites cs ON sr.site_id = cs.id " +
            "JOIN companies c ON cs.company_id = c.id " +
            "JOIN users u ON c.user_id = u.id " +
            "WHERE u.email = :email AND cs.id = :siteId", nativeQuery = true)
    List<Object[]> findSensorsBySiteAndEmail(@Param("email") String email, @Param("siteId") Integer siteId);

    // ==========================================
    // GOVERNMENT QUERY (NO EMAIL CHECK)
    // ==========================================
    @Query(value = "SELECT c.company_name, cs.site_name, sr.sensor_id, sr.latitude, sr.longitude, sr.status " +
            "FROM sensor_registry sr " +
            "JOIN company_sites cs ON sr.site_id = cs.id " +
            "JOIN companies c ON cs.company_id = c.id " +
            "WHERE cs.id = :siteId", nativeQuery = true)
    List<Object[]> findAllSensorsBySiteId(@Param("siteId") Integer siteId);

    //List<SensorRegistry> findByLocationNameContainingIgnoreCase(String locationName);
}

