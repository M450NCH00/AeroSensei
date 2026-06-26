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
    @Query(value = "SELECT sr.* FROM sensor_registry sr " +
            "JOIN company_sites cs ON sr.site_id = cs.id " +
            "JOIN companies c ON cs.company_id = c.id " +
            "JOIN users u ON c.user_id = u.id " +
            "WHERE sr.latitude BETWEEN :minLat AND :maxLat " +
            "AND sr.longitude BETWEEN :minLon AND :maxLon " +
            "AND u.email = :userEmail", nativeQuery = true)
    List<SensorRegistry> findCompanySensorsWithinBounds(
            @Param("minLat") BigDecimal minLat,
            @Param("maxLat") BigDecimal maxLat,
            @Param("minLon") BigDecimal minLon,
            @Param("maxLon") BigDecimal maxLon,
            @Param("userEmail") String userEmail);

    //use to fetch the sensors from the company of the user
    @Query(value = "SELECT sr.* FROM sensor_registry sr " +
            "JOIN company_sites cs ON sr.site_id = cs.id " +
            "JOIN companies c ON cs.company_id = c.id " +
            "JOIN users u ON c.user_id = u.id " +
            "WHERE u.email = :userEmail", nativeQuery = true)
    List<SensorRegistry> findAllCompanySensorsByEmail(
            @Param("userEmail") String userEmail);

    //use to fetch sensor by company and site name
    @Query(value = "SELECT c.company_name, sr.site_id, cs.site_name, sr.sensor_id, sr.latitude, sr.longitude, sr.status " +
            "FROM sensor_registry sr " +
            "JOIN company_sites cs ON sr.site_id = cs.id " +
            "JOIN companies c ON cs.company_id = c.id " +
            "JOIN users u ON c.user_id = u.id " +
            "WHERE u.email = :email", nativeQuery = true)
    List<Object[]> findSensorsDetailsByEmail(@Param("email") String email);

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
    //use to fetch the sensors from the company of the user
    @Query(value = "SELECT sr.* FROM sensor_registry sr " +
            "JOIN company_sites cs ON sr.site_id = cs.id " +
            "JOIN companies c ON cs.company_id = c.id ", nativeQuery = true)
    List<SensorRegistry> findAllSensors();

    @Query(value = "SELECT c.company_name, sr.site_id, cs.site_name, sr.sensor_id, sr.latitude, sr.longitude, sr.status " +
            "FROM sensor_registry sr " +
            "JOIN company_sites cs ON sr.site_id = cs.id " +
            "JOIN companies c ON cs.company_id = c.id ", nativeQuery = true)
    List<Object[]> findAllSensorsDetails();

    @Query(value = "SELECT c.company_name, cs.site_name, sr.sensor_id, sr.latitude, sr.longitude, sr.status " +
            "FROM sensor_registry sr " +
            "JOIN company_sites cs ON sr.site_id = cs.id " +
            "JOIN companies c ON cs.company_id = c.id " +
            "WHERE cs.id = :siteId", nativeQuery = true)
    List<Object[]> findAllSensorsBySiteId(@Param("siteId") Integer siteId);

    // Fetch UUIDs for a site (Company specific)
    @Query(value = "SELECT CAST(sr.id AS VARCHAR) FROM sensor_registry sr " +
            "JOIN company_sites cs ON sr.site_id = cs.id " +
            "JOIN companies c ON cs.company_id = c.id " +
            "JOIN users u ON c.user_id = u.id " +
            "WHERE cs.id = :siteId AND u.email = :email", nativeQuery = true)
    List<String> findSensorUuidsBySiteIdAndEmail(@Param("siteId") Integer siteId, @Param("email") String email);

    // Fetch UUIDs for a site (Government Master Key)
    @Query(value = "SELECT CAST(sr.id AS VARCHAR) FROM sensor_registry sr " +
            "WHERE sr.site_id = :siteId", nativeQuery = true)
    List<String> findSensorUuidsBySiteId(@Param("siteId") Integer siteId);

    // ==========================================
    // SECURITY OWNERSHIP CHECKS
    // ==========================================

    // Checks if a Site belongs to a specific user's company
    @Query(value = "SELECT EXISTS (SELECT 1 FROM company_sites cs " +
            "JOIN companies c ON cs.company_id = c.id " +
            "JOIN users u ON c.user_id = u.id " +
            "WHERE cs.id = :siteId AND u.email = :email)", nativeQuery = true)
    boolean existsBySiteIdAndUserEmail(@Param("siteId") Integer siteId, @Param("email") String email);

    // Checks if a Sensor belongs to a specific user's company
    @Query(value = "SELECT EXISTS (SELECT 1 FROM sensor_registry sr " +
            "JOIN company_sites cs ON sr.site_id = cs.id " +
            "JOIN companies c ON cs.company_id = c.id " +
            "JOIN users u ON c.user_id = u.id " +
            "WHERE sr.sensor_id = :sensorId AND u.email = :email)", nativeQuery = true)
    boolean existsBySensorIdAndUserEmail(@Param("sensorId") String sensorId, @Param("email") String email);

    @Query(value = "SELECT site_id FROM sensor_registry WHERE sensor_id = :sensor_id", nativeQuery = true)
    int findSiteIdBySensorId(@Param("sensor_id") String sensor_id);

    // Fetch the UUID (sensor_id) using the ESP32 string (device_label)
    @Query(value = "SELECT id FROM sensor_registry WHERE sensor_id = :deviceLabel", nativeQuery = true)
    Optional<String> findSensorIdByDeviceLabel(@Param("deviceLabel") String deviceLabel);
}

