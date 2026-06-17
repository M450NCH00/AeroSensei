package com.aerosensei.service;

import com.influxdb.client.InfluxDBClient;
import com.influxdb.query.FluxRecord;
import com.influxdb.query.FluxTable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;
import java.util.concurrent.TimeUnit;
import java.time.Instant;

import com.aerosensei.entity.SensorRegistry;
import com.aerosensei.repository.SensorRegistryRepository;
import com.aerosensei.dto.SensorAverageDTO;
import com.aerosensei.dto.ClusterAverageDTO;
import com.aerosensei.dto.SensorDataWithLocationDTO;
import com.aerosensei.dto.SensorInfoDTO;
import com.aerosensei.dto.SensorRegistrationDTO;

import com.github.davidmoten.geo.GeoHash;

@Service
public class SensorService {

    private static final Logger logs = LoggerFactory.getLogger(SensorService.class);

    @Autowired
    private InfluxDBClient influxDBClient;

    @Autowired
    private SensorRegistryRepository registryRepository;

    //redis properties
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    //influxdb properties
    @Value("${influxdb.org}")
    private String org;

    @Value("${influxdb.bucket}")
    private String bucket;

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

    //Get by area boundaries
    public List<SensorInfoDTO> getSensorsWithinArea(BigDecimal minLat, BigDecimal maxLat, BigDecimal minLon, BigDecimal maxLon) {
        List<SensorRegistry> sensors = registryRepository.findSensorsWithinBounds(minLat, maxLat, minLon, maxLon);

        return sensors.stream().map(sensor -> new SensorInfoDTO(
                sensor.getSensorId(),
                sensor.getLocationName(),
                sensor.getLatitude(),
                sensor.getLongitude(),
                sensor.getStatus()
        )).collect(Collectors.toList());
    }

    //Get average for single sensor
    public SensorAverageDTO getRealTimeAverage(String sensorId) {
        logs.info("Requesting real-time average for sensor: {}", sensorId);
        String redisKey = "sensor_avg:" + sensorId;

        // Check Redis first
        SensorAverageDTO cachedData = (SensorAverageDTO) redisTemplate.opsForValue().get(redisKey);
        if (cachedData != null) {
            logs.info("REDIS HIT: Returning cached data for sensor: {}", sensorId);
            return cachedData;
        }

        logs.info("REDIS MISS: Fetching fresh data from InfluxDB for sensor: {}", sensorId);

        // Not in Redis -> Fetch UUID from PostgreSQL
        SensorRegistry registry = registryRepository.findBySensorId(sensorId)
                .orElseThrow(() -> {
                    logs.error("Sensor ID not found in PostgreSQL: {}", sensorId);
                    return new RuntimeException("Sensor not found in database: " + sensorId);
                });

        String influxUuid = registry.getId().toString();

        // Query InfluxDB
        String fluxQuery = String.format(
                "from(bucket:\"%s\") " +
                        "|> range(start: -15m) " +
                        "|> filter(fn: (r) => r._measurement == \"air_quality\") " +
                        "|> filter(fn: (r) => r.sensor_id == \"%s\") " +
                        "|> mean()", bucket, influxUuid
        );

        List<FluxTable> tables = influxDBClient.getQueryApi().query(fluxQuery, org);

        SensorAverageDTO dto = new SensorAverageDTO();
        dto.setSensorId(sensorId);
        dto.setLocationName(registry.getLocationName());
        dto.setLastCalculated(Instant.now());

        for (FluxTable table : tables) {
            for (FluxRecord record : table.getRecords()) {
                String field = record.getField();
                Double avgValue = (Double) record.getValue();

                if (avgValue != null) {
                    if ("pm2_5".equals(field)) {
                        dto.setPm25(Math.round(avgValue * 100.0) / 100.0);
                    } else if ("pm10".equals(field)) {
                        dto.setPm10(Math.round(avgValue * 100.0) / 100.0);
                    }
                }
            }
        }

        // Save to Redis for 10 minutes
        logs.info("Caching calculated average in Redis for 10 minutes for sensor: {}", sensorId);
        redisTemplate.opsForValue().set(redisKey, dto, 10, TimeUnit.MINUTES);

        return dto;
    }

    //get the average in a specific area
    public List<SensorAverageDTO> getRealTimeAveragesInArea(BigDecimal minLat, BigDecimal maxLat, BigDecimal minLon, BigDecimal maxLon) {
        logs.info("Fetching real-time averages for map area [MinLat: {}, MaxLat: {}, MinLon: {}, MaxLon: {}]", minLat, maxLat, minLon, maxLon);

        // Find which sensors are in the area
        List<SensorRegistry> sensorsInArea = registryRepository.findSensorsWithinBounds(minLat, maxLat, minLon, maxLon);

        logs.info("Found {} sensors physically located in this bounding box.", sensorsInArea.size());

        // Loop through them (this will trigger the Redis hit/miss logs for each individual sensor!)
        return sensorsInArea.stream()
                .map(sensor -> getRealTimeAverage(sensor.getSensorId()))
                .collect(Collectors.toList());
    }

    /**
     * Maps frontend map zoom levels to geohash precision levels.
     * Tweak these ranges if you want clusters to break apart sooner or later.
     */
    private int mapZoomToPrecision(int zoomLevel) {
        if (zoomLevel <= 5) return 3;  // Zoomed out to continents
        if (zoomLevel <= 8) return 4;  // Zoomed out to countries
        if (zoomLevel <= 11) return 5; // Regions / Large Cities
        if (zoomLevel <= 13) return 6; // City Districts
        if (zoomLevel <= 15) return 7; // Neighborhoods
        if (zoomLevel <= 17) return 8; // City Blocks
        return 9;                      // Zoomed all the way in (Raw Sensors)
    }

    // clustering area sensor function
    public List<ClusterAverageDTO> getClusteredAveragesInArea(
            BigDecimal minLat, BigDecimal maxLat, BigDecimal minLon, BigDecimal maxLon, int zoom) {

        // Translate the map zoom into a database string prefix length
        int precision = mapZoomToPrecision(zoom);
        logs.info("Clustering map area using zoom level {} -> geohash precision {}", zoom, precision);

        // Get all sensors in the view (Fast DB query)
        List<SensorRegistry> sensorsInArea = registryRepository.findSensorsWithinBounds(minLat, maxLat, minLon, maxLon);

        if (sensorsInArea.isEmpty()) {
            return new ArrayList<>();
        }

        // Map to hold our grouped data. Key: "Geohash Prefix"
        Map<String, List<SensorRegistry>> clusteredSensors = new HashMap<>();

        // Assign each sensor to a cluster based on its geohash prefix
        for (SensorRegistry sensor : sensorsInArea) {
            // Safety check: Don't substring further than the actual geohash length
            int actualPrecision = Math.min(precision, sensor.getGeohash().length());
            String prefix = sensor.getGeohash().substring(0, actualPrecision);

            clusteredSensors.computeIfAbsent(prefix, k -> new ArrayList<>()).add(sensor);
        }

        // Calculate the centroids and averages for each cluster
        List<ClusterAverageDTO> clusteredResults = new ArrayList<>();

        for (Map.Entry<String, List<SensorRegistry>> entry : clusteredSensors.entrySet()) {
            List<SensorRegistry> cellSensors = entry.getValue();

            double sumLat = 0;
            double sumLon = 0;
            double sumPm25 = 0;
            double sumPm10 = 0;
            int validSensorCount = 0;

            for (SensorRegistry sensor : cellSensors) {
                // Get the ultra-fast cached real-time data
                SensorAverageDTO liveData = getRealTimeAverage(sensor.getSensorId());

                if (liveData.getPm25() == null) continue; // Skip offline sensors

                // Sum up ACTUAL coordinates for the centroid calculation
                sumLat += sensor.getLatitude().doubleValue();
                sumLon += sensor.getLongitude().doubleValue();

                sumPm25 += liveData.getPm25();
                sumPm10 += liveData.getPm10();

                validSensorCount++;
            }

            // If all sensors in this cluster were offline, skip it entirely
            if (validSensorCount == 0) continue;

            // CALCULATE CENTROIDS (Average of all valid sensor coordinates)
            double centroidLat = sumLat / validSensorCount;
            double centroidLon = sumLon / validSensorCount;

            double avgPm25 = Math.round((sumPm25 / validSensorCount) * 100.0) / 100.0;
            double avgPm10 = Math.round((sumPm10 / validSensorCount) * 100.0) / 100.0;

            clusteredResults.add(new ClusterAverageDTO(
                BigDecimal.valueOf(centroidLat),
                BigDecimal.valueOf(centroidLon),
                avgPm25,
                avgPm10,
                validSensorCount
            ));
        }

        logs.info("Reduced {} raw sensors into {} clean map clusters.", sensorsInArea.size(), clusteredResults.size());
        return clusteredResults;
    }

    public List<SensorDataWithLocationDTO> searchSensorsByLocation(String locationName) {
        logs.info("Searching for sensors matching location: {}", locationName);

        // 1. Fetch matching database records
        List<SensorRegistry> matchingSensors = registryRepository.findByLocationNameContainingIgnoreCase(locationName);

        List<SensorDataWithLocationDTO> combinedResults = new ArrayList<>();

        // 2. Loop through and bundle the metadata with the live Redis/Influx data
        for (SensorRegistry sensor : matchingSensors) {

            // Convert the DB entity into your existing SensorInfoDTO
            SensorInfoDTO infoDTO = new SensorInfoDTO(
                    sensor.getSensorId(),
                    sensor.getLocationName(),
                    sensor.getLatitude(),
                    sensor.getLongitude(),
                    sensor.getStatus()
            );

            // Fetch the fast live reading (this is your existing method!)
            SensorAverageDTO liveData = getRealTimeAverage(sensor.getSensorId());

            // Bundle them together
            combinedResults.add(new SensorDataWithLocationDTO(infoDTO, liveData));
        }

        logs.info("Search complete. Found {} sensors.", combinedResults.size());
        return combinedResults;
    }

    public SensorInfoDTO registerNewSensor(SensorRegistrationDTO dto) {
        logs.info("Attempting to register new sensor: {}", dto.getSensorId());

        // 1. (Optional but recommended) Check if the sensor ID already exists
        Optional<SensorRegistry> existingSensor = registryRepository.findBySensorId(dto.getSensorId());

        if (existingSensor.isPresent()) {
            throw new RuntimeException("A sensor with ID " + dto.getSensorId() + " is already registered!");
        }

        // 2. Create a new Database Entity
        SensorRegistry newSensor = new SensorRegistry();
        newSensor.setSensorId(dto.getSensorId());
        newSensor.setLocationName(dto.getLocationName());
        newSensor.setLatitude(dto.getLatitude());
        newSensor.setLongitude(dto.getLongitude());
        newSensor.setStatus("ACTIVE"); // Default to ACTIVE upon registration

        String hash = GeoHash.encodeHash(
            dto.getLatitude().doubleValue(),
            dto.getLongitude().doubleValue(),
            9
        );
        newSensor.setGeohash(hash);

        // 3. Save it to PostgreSQL
        SensorRegistry savedSensor = registryRepository.save(newSensor);
        logs.info("Successfully registered sensor {} at {}", savedSensor.getSensorId(), savedSensor.getLocationName());

        // 4. Return it as a DTO to the frontend so they know it succeeded
        return new SensorInfoDTO(
                savedSensor.getSensorId(),
                savedSensor.getLocationName(),
                savedSensor.getLatitude(),
                savedSensor.getLongitude(),
                savedSensor.getStatus()
        );
    }

    public void deleteSensor(String sensorId) {
        logs.info("🗑Attempting to delete sensor: {}", sensorId);

        // 1. Check if the sensor actually exists first
        if (!registryRepository.existsBySensorId(sensorId)) {
            throw new RuntimeException("Sensor with ID " + sensorId + " not found!");
        }

        // 2. Delete it from the PostgreSQL database
        registryRepository.deleteBySensorId(sensorId);

        logs.info("Successfully deleted sensor: {}", sensorId);
    }
}