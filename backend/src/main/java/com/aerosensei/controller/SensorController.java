package com.aerosensei.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.math.BigDecimal;
import java.util.Map;

import com.aerosensei.service.SensorService;
import com.aerosensei.dto.ClusterMaxDTO;
import com.aerosensei.dto.SensorRegistrationDTO;
import com.aerosensei.dto.SiteHistoricalDataDTO;
import com.aerosensei.dto.SiteSensor15MinDTO;

@RestController
@RequestMapping("/api/sensors")
public class SensorController {

    @Autowired
    private SensorService sensorService;

    private static final Logger logs = LoggerFactory.getLogger(SensorController.class);
  
    // URL: GET http://localhost:8080/api/sensors/area/cluster?minLat=...&maxLat=...&minLon=...&maxLon=...&zoom=12
    @GetMapping("/area/cluster")
    public ResponseEntity<List<ClusterMaxDTO>> getClusteredArea(
            @RequestParam BigDecimal minLat,
            @RequestParam BigDecimal maxLat,
            @RequestParam BigDecimal minLon,
            @RequestParam BigDecimal maxLon,
            @RequestParam(defaultValue = "12") int zoom,
            Authentication authentication) {

        // Pass authentication to the service
        List<ClusterMaxDTO> clusteredData = sensorService.getClusteredMaxInArea(
                minLat, maxLat, minLon, maxLon, zoom, authentication);

        return ResponseEntity.ok(clusteredData);
    }

    // URL: GET http://localhost:8080/api/sensors/site/1/history
    @GetMapping("/site/{siteId}/history")
    public ResponseEntity<List<SiteHistoricalDataDTO>> getSiteHistory(
            @PathVariable Integer siteId,
            Authentication authentication) {

        List<SiteHistoricalDataDTO> historyData = sensorService.getSiteHistoricalAverage(siteId, authentication);
        return ResponseEntity.ok(historyData);
    }

    // URL: GET http://localhost:8080/api/sensors/site/1/average-15m
    @GetMapping("/site/{siteId}/average-15m")
    public ResponseEntity<List<SiteSensor15MinDTO>> getSiteSensors15MinAverage(
            @PathVariable Integer siteId,
            Authentication authentication) {

        List<SiteSensor15MinDTO> data = sensorService.getSiteSensors15MinAverage(siteId, authentication);
        return ResponseEntity.ok(data);
    }

    // URL: POST http://localhost:8080/api/sensors/register
    @PostMapping("/register")
    public ResponseEntity<?> registerSensor(@RequestBody SensorRegistrationDTO dto, Authentication authentication) {
        try {
            sensorService.registerSensor(dto, authentication);
            return ResponseEntity.ok().body(Map.of("message", "Sensor registered successfully!", "sensorId", dto.getSensorId()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // URL: DELETE http://localhost:8080/api/sensors/{sensorId}
    @DeleteMapping("/{sensorId}")
    public ResponseEntity<?> deleteSensor(@PathVariable String sensorId, Authentication authentication) {
        try {
            sensorService.deleteSensor(sensorId, authentication);
            return ResponseEntity.ok().body(Map.of("message", "Sensor deleted successfully!", "sensorId", sensorId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}