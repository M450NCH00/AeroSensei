package com.aerosensei.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

import com.aerosensei.service.SensorService;
import com.aerosensei.dto.CompanyDashboardSensorDTO;

@RestController
@RequestMapping("/api/sensors")
public class SensorController {

    @Autowired
    private SensorService sensorService;

    private static final Logger logs = LoggerFactory.getLogger(SensorController.class);

//    // URL: GET http://localhost:8081/api/sensors/company/dashboard
//    @GetMapping("/company/dashboard")
//    public ResponseEntity<List<CompanyDashboardSensorDTO>> getCompanyDashboard(Authentication authentication) {
//        // authentication.getName() automatically extracts the email from the JWT Token!
//        String userEmail = authentication.getName();
//
//        List<CompanyDashboardSensorDTO> dashboard = sensorService.getCompanyDashboard(userEmail);
//
//        return ResponseEntity.ok(dashboard);
//    }
//
//    // URL: GET http://localhost:8081/api/sensors/site/{siteId}
//    @GetMapping("/site/{siteId}")
//    public ResponseEntity<?> getSiteSensors(@PathVariable Integer siteId, Authentication authentication) {
//        try {
//            // Pass the whole authentication object so the service can check roles!
//            List<CompanyDashboardSensorDTO> sensors = sensorService.getSiteSensors(authentication, siteId);
//            return ResponseEntity.ok(sensors);
//        } catch (RuntimeException e) {
//            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
//        }
//    }

//    // Expose endpoint: GET /api/sensors/info
//    @GetMapping("/info")
//    public ResponseEntity<List<SensorInfoDTO>> getAllSensorsInfo() {
//        List<SensorInfoDTO> sensorInfo = sensorService.getAllSensorsInfo();
//        return ResponseEntity.ok(sensorInfo);
//    }
//
//    // Expose endpoint: GET http://localhost:8080/api/sensors/area?minLat=...&maxLat=...&minLon=...&maxLon=...
//    @GetMapping("/area")
//    public ResponseEntity<List<SensorInfoDTO>> getSensorsInArea(
//            @RequestParam BigDecimal minLat,
//            @RequestParam BigDecimal maxLat,
//            @RequestParam BigDecimal minLon,
//            @RequestParam BigDecimal maxLon) {
//
//        List<SensorInfoDTO> boundedSensors = sensorService.getSensorsWithinArea(minLat, maxLat, minLon, maxLon);
//        return ResponseEntity.ok(boundedSensors);
//    }
//
//    //Expose endpoint: GET http://localhost:8080/api/sensors/{sensor_id}/average
//    @GetMapping("/{sensorId}/average")
//    public ResponseEntity<SensorAverageDTO> getSensorAverage(@PathVariable String sensorId) {
//        logs.info("API Call: GET /api/sensors/{}/average", sensorId);
//        SensorAverageDTO averageData = sensorService.getRealTimeAverage(sensorId);
//        return ResponseEntity.ok(averageData);
//    }
//
//    //Expose endpoint: GET http://localhost:8080/api/sensors/area/average?minLat=...&maxLat=...&minLon=...&maxLon=...
//    @GetMapping("/area/average")
//    public ResponseEntity<List<SensorAverageDTO>> getAveragesInArea(
//            @RequestParam BigDecimal minLat,
//            @RequestParam BigDecimal maxLat,
//            @RequestParam BigDecimal minLon,
//            @RequestParam BigDecimal maxLon) {
//
//        logs.info("API Call: GET /api/sensors/area/average");
//        List<SensorAverageDTO> areaData = sensorService.getRealTimeAveragesInArea(minLat, maxLat, minLon, maxLon);
//        return ResponseEntity.ok(areaData);
//    }
//
//
//    // URL: GET http://localhost:8081/api/sensors/search?location=Hanoi
//    @GetMapping("/search")
//    public ResponseEntity<List<SensorDataWithLocationDTO>> searchByLocation(@RequestParam String location) {
//
//        List<SensorDataWithLocationDTO> results = sensorService.searchSensorsByLocation(location);
//
//        if (results.isEmpty()) {
//            return ResponseEntity.noContent().build();
//        }
//
//        return ResponseEntity.ok(results);
//    }
//
//    // URL: POST http://localhost:8081/api/sensors/register
//    @PostMapping("/register")
//    public ResponseEntity<SensorInfoDTO> registerSensor(@RequestBody SensorRegistrationDTO registrationDTO) {
//        try {
//            SensorInfoDTO savedSensor = sensorService.registerNewSensor(registrationDTO);
//            return ResponseEntity.status(HttpStatus.CREATED).body(savedSensor);
//        } catch (RuntimeException e) {
//            // If the sensor already exists, return a 400 Bad Request
//            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
//        }
//    }
//
//    @Transactional
//    @DeleteMapping("/{sensorId}")
//    public ResponseEntity<String> deleteSensor(@PathVariable String sensorId) {
//        try {
//            sensorService.deleteSensor(sensorId);
//            return ResponseEntity.ok("Sensor " + sensorId + " has been successfully deleted from the registry.");
//        } catch (RuntimeException e) {
//            // Returns a 404 Not Found if the ID doesn't exist
//            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
//        }
//    }
  
    // URL: GET http://localhost:8080/api/sensors/area/cluster?minLat=...&maxLat=...&minLon=...&maxLon=...&rows=4&cols=4
    @GetMapping("/area/cluster")
    public ResponseEntity<List<ClusterAverageDTO>> getClusteredArea(
            @RequestParam BigDecimal minLat,
            @RequestParam BigDecimal maxLat,
            @RequestParam BigDecimal minLon,
            @RequestParam BigDecimal maxLon,
            @RequestParam(defaultValue = "12") int zoom) {

        List<ClusterAverageDTO> clusteredData = sensorService.getClusteredAveragesInArea(minLat, maxLat, minLon, maxLon, zoom);
        return ResponseEntity.ok(clusteredData);
    }
}