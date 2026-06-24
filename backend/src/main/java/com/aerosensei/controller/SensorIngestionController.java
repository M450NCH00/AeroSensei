package com.aerosensei.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;

import com.aerosensei.service.SlidingWindowService;
import com.aerosensei.dto.DataRecordDTO;

@RestController
@RequestMapping("/api/sensors")
public class SensorIngestionController {

    @Autowired
    private SlidingWindowService slidingWindowService;

    @PostMapping("/ingest")
    public ResponseEntity<String> ingestSensorData(@RequestBody DataRecordDTO.SensorPayLoad payload) throws Exception {
//        // If the sensor doesn't provide a timestamp, generate one immediately
//        if (payload.timestamp() == null) {
//            payload = new DataRecordDTO.SensorPayLoad(
//                    payload.sensorId(),
//                    payload.siteId(),
//                    payload.pm2_5(),
//                    payload.pm10(),
//                    Instant.now()
//            );
//        }

        // Pass to the service to process the sliding window
        slidingWindowService.processIncomingReading(payload);

        // Return immediately so the HTTP thread is freed up
        return ResponseEntity.ok("Received");
    }
}