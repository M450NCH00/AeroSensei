package com.aerosensei.repository;

import com.aerosensei.entity.SensorRegistry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SensorRegistryRepository extends JpaRepository<SensorRegistry, Long> {
    // Allows us to look up a site name using the sensor ID found in InfluxDB
    SensorRegistry findBySensorId(String sensorId);
}