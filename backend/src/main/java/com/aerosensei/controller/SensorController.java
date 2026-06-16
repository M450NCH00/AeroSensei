package com.aerosensei.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.util.List;

import com.aerosensei.dto.ClusterAverageDTO;
import com.aerosensei.dto.SensorAverageDTO;
import com.aerosensei.service.SensorService;
import com.aerosensei.dto.SensorInfoDTO;
import com.aerosensei.dto.SensorDataWithLocationDTO;
import com.aerosensei.dto.SensorRegistrationDTO;

@RestController
@RequestMapping("/api/sensors")
public class SensorController {

    @Autowired
    private SensorService sensorService;

    private static final Logger logs = LoggerFactory.getLogger(SensorController.class);

    // Expose endpoint: GET /api/sensors/info
    @GetMapping("/info")
    public ResponseEntity<List<SensorInfoDTO>> getAllSensorsInfo() {
        List<SensorInfoDTO> sensorInfo = sensorService.getAllSensorsInfo();
        return ResponseEntity.ok(sensorInfo);
    }

    // Expose endpoint: GET http://localhost:8080/api/sensors/area?minLat=...&maxLat=...&minLon=...&maxLon=...
    @GetMapping("/area")
    public ResponseEntity<List<SensorInfoDTO>> getSensorsInArea(
            @RequestParam BigDecimal minLat,
            @RequestParam BigDecimal maxLat,
            @RequestParam BigDecimal minLon,
            @RequestParam BigDecimal maxLon) {

        List<SensorInfoDTO> boundedSensors = sensorService.getSensorsWithinArea(minLat, maxLat, minLon, maxLon);
        return ResponseEntity.ok(boundedSensors);
    }

    //Expose endpoint: GET http://localhost:8080/api/sensors/{sensor_id}/average
    @GetMapping("/{sensorId}/average")
    public ResponseEntity<SensorAverageDTO> getSensorAverage(@PathVariable String sensorId) {
        logs.info("API Call: GET /api/sensors/{}/average", sensorId);
        SensorAverageDTO averageData = sensorService.getRealTimeAverage(sensorId);
        return ResponseEntity.ok(averageData);
    }

    //Expose endpoint: GET http://localhost:8080/api/sensors/area/average?minLat=...&maxLat=...&minLon=...&maxLon=...
    @GetMapping("/area/average")
    public ResponseEntity<List<SensorAverageDTO>> getAveragesInArea(
            @RequestParam BigDecimal minLat,
            @RequestParam BigDecimal maxLat,
            @RequestParam BigDecimal minLon,
            @RequestParam BigDecimal maxLon) {

        logs.info("API Call: GET /api/sensors/area/average");
        List<SensorAverageDTO> areaData = sensorService.getRealTimeAveragesInArea(minLat, maxLat, minLon, maxLon);
        return ResponseEntity.ok(areaData);
    }

    // URL: GET http://localhost:8080/api/sensors/area/cluster?minLat=...&maxLat=...&minLon=...&maxLon=...&rows=4&cols=4
    @GetMapping("/area/cluster")
    public ResponseEntity<List<ClusterAverageDTO>> getClusteredArea(
            @RequestParam BigDecimal minLat,
            @RequestParam BigDecimal maxLat,
            @RequestParam BigDecimal minLon,
            @RequestParam BigDecimal maxLon,
            @RequestParam(defaultValue = "4") int rows,
            @RequestParam(defaultValue = "4") int cols) {

        List<ClusterAverageDTO> clusteredData = sensorService.getClusteredAveragesInArea(minLat, maxLat, minLon, maxLon, rows, cols);
        return ResponseEntity.ok(clusteredData);
    }
    
    // URL: GET http://localhost:8081/api/sensors/search?location=Hanoi
    @GetMapping("/search")
    public ResponseEntity<List<SensorDataWithLocationDTO>> searchByLocation(@RequestParam String location) {

        List<SensorDataWithLocationDTO> results = sensorService.searchSensorsByLocation(location);

        if (results.isEmpty()) {
            return ResponseEntity.noContent().build();
        }

        return ResponseEntity.ok(results);
    }

    // URL: POST http://localhost:8081/api/sensors/register
    @PostMapping("/register")
    public ResponseEntity<SensorInfoDTO> registerSensor(@RequestBody SensorRegistrationDTO registrationDTO) {
        try {
            SensorInfoDTO savedSensor = sensorService.registerNewSensor(registrationDTO);
            return ResponseEntity.status(HttpStatus.CREATED).body(savedSensor);
        } catch (RuntimeException e) {
            // If the sensor already exists, return a 400 Bad Request
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        }
    }

    @Transactional
    @DeleteMapping("/{sensorId}")
    public ResponseEntity<String> deleteSensor(@PathVariable String sensorId) {
        try {
            sensorService.deleteSensor(sensorId);
            return ResponseEntity.ok("Sensor " + sensorId + " has been successfully deleted from the registry.");
        } catch (RuntimeException e) {
            // Returns a 404 Not Found if the ID doesn't exist
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }
}