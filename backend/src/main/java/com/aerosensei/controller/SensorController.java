package com.aerosensei.controller;

import com.aerosensei.dto.ClusterAverageDTO;
import com.aerosensei.dto.SensorAverageDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.util.List;

import com.aerosensei.service.SensorService;
import com.aerosensei.dto.SensorInfoDTO;

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
}