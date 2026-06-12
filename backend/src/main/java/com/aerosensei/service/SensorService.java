package com.aerosensei.service;

import com.influxdb.client.InfluxDBClient;
import com.influxdb.query.FluxRecord;
import com.influxdb.query.FluxTable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import com.aerosensei.dto.SensorInfoDTO;
import com.aerosensei.dto.SensorReadingDTO;
import com.aerosensei.entity.SensorRegistry;
import com.aerosensei.repository.SensorRegistryRepository;

@Service
public class SensorService {

    private static final Logger logs = LoggerFactory.getLogger(SensorService.class);

    @Autowired
    private InfluxDBClient influxDBClient;

    @Autowired
    private SensorRegistryRepository registryRepository;

    @Value("${influxdb.org}")
    private String org;

    @Value("${influxdb.bucket}")
    private String bucket;

    public List<SensorReadingDTO> getRecentReadings() {
        List<SensorReadingDTO> dtoList = new ArrayList<>();

        // 1. Flux Query: Get air quality readings from the last hour
        String fluxQuery = String.format(
                "from(bucket:\"%s\") |> range(start: -1h) |> filter(fn: (r) => r._measurement == \"air_quality\")",
                bucket
        );

        // 2. Execute query against InfluxDB
        List<FluxTable> tables = influxDBClient.getQueryApi().query(fluxQuery, org);

        // 3. Loop through the Influx records
        for (FluxTable table : tables) {
            for (FluxRecord record : table.getRecords()) {

                // Extract data from Influx record
                String sensorId = (String) record.getValueByKey("sensor_id"); // Assuming you tagged data with sensor_id
                Double value = (Double) record.getValueByKey("_value");
                var timestamp = record.getTime();

                // 4. Fetch the Site Name from PostgreSQL
                String siteName = "Unknown Site";
                if (sensorId != null) {
                    SensorRegistry registry = registryRepository.findBySensorId(sensorId);
                    if (registry != null) {
                        siteName = registry.getLocationName();
                    }
                }

                // 5. Combine them into the DTO
                dtoList.add(new SensorReadingDTO(sensorId, siteName, value, timestamp));
            }
        }

        return dtoList;
    }

    public List<SensorInfoDTO> getAllSensorsInfo() {
        logs.info("Fetching all the sensors info data");

        // Fetch all sensors from PostgreSQL
        List<SensorRegistry> sensors = registryRepository.findAll();

        // Convert the raw Entities into clean DTOs
        return sensors.stream().map(sensor -> new SensorInfoDTO(
                sensor.getSensorId(),
                sensor.getLocationName(),
                sensor.getLatitude(),
                sensor.getLongitude(),
                sensor.getStatus()
        )).collect(Collectors.toList());
    }
}