package com.aerosensei.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

import com.aerosensei.dto.SensorReadingDTO;
import com.aerosensei.service.SensorService;
import com.aerosensei.dto.SensorInfoDTO;

@RestController
@RequestMapping("/api/sensors")
public class SensorController {

    @Autowired
    private SensorService sensorService;

    // Expose endpoint: GET /api/sensors/readings
    @GetMapping("/readings")
    public ResponseEntity<List<SensorReadingDTO>> getReadings() {
        return ResponseEntity.ok(sensorService.getRecentReadings());
    }

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
}