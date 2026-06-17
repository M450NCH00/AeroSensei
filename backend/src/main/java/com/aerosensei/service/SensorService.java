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
import org.springframework.security.core.Authentication;

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
import com.aerosensei.dto.CompanyDashboardSensorDTO;



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

    // ==========================================
    // GET COMPANY DASHBOARD (DOUBLE CACHE)
    // ==========================================
    public List<CompanyDashboardSensorDTO> getCompanyDashboard(String userEmail) {
        String metadataCacheKey = "company_metadata:" + userEmail;

        // CACHE 1: Check Redis for the heavy PostgreSQL Metadata (lasts 24 hours)
        List<CompanyDashboardSensorDTO> dashboardSensors = (List<CompanyDashboardSensorDTO>) redisTemplate.opsForValue().get(metadataCacheKey);

        if (dashboardSensors == null) {
            logs.info("REDIS MISS: Fetching company metadata from DB for user: {}", userEmail);
            List<Object[]> results = registryRepository.findCompanySensorMetadataByEmail(userEmail);

            dashboardSensors = new ArrayList<>();
            for (Object[] row : results) {
                CompanyDashboardSensorDTO dto = new CompanyDashboardSensorDTO();
                dto.setCompanyName((String) row[0]);
                dto.setSiteName((String) row[1]);
                dto.setSensorId((String) row[2]);
                dto.setLatitude((BigDecimal) row[3]);
                dto.setLongitude((BigDecimal) row[4]);
                dto.setDbStatus((String) row[5]);
                dashboardSensors.add(dto);
            }
            // Save metadata to Redis
            if (!dashboardSensors.isEmpty()) {
                redisTemplate.opsForValue().set(metadataCacheKey, dashboardSensors, 24, TimeUnit.HOURS);
            }
        }

        // CACHE 2: Check live InfluxDB data for the 1-Hour Online Status
        for (CompanyDashboardSensorDTO sensor : dashboardSensors) {
            fetchLiveStatus(sensor);
        }

        return dashboardSensors;
    }

    private void fetchLiveStatus(CompanyDashboardSensorDTO sensor) {
        String liveCacheKey = "live_status_1h:" + sensor.getSensorId();

        // Check if we checked this sensor's live status in the last 60 seconds
        CompanyDashboardSensorDTO cachedLiveStatus = (CompanyDashboardSensorDTO) redisTemplate.opsForValue().get(liveCacheKey);

        if (cachedLiveStatus != null) {
            sensor.setOnline(cachedLiveStatus.isOnline());
            sensor.setPm25(cachedLiveStatus.getPm25());
            sensor.setPm10(cachedLiveStatus.getPm10());
            sensor.setLastReadingTime(cachedLiveStatus.getLastReadingTime());
            return;
        }

        // THE 1-HOUR INFLUXDB QUERY
        // Uses `last()` to just grab the single most recent data point in the last hour
        String flux = String.format(
                "from(bucket:\"sensors_data\") " +
                        "|> range(start: -1h) " +
                        "|> filter(fn: (r) => r._measurement == \"air_quality\" and r.sensor_id == \"%s\") " +
                        "|> last()", sensor.getSensorId()
        );

        List<FluxTable> tables = influxDBClient.getQueryApi().query(flux, "my-org");

        if (tables.isEmpty()) {
            sensor.setOnline(false); // No data in the last 1 hour!
        } else {
            sensor.setOnline(true);
            for(FluxTable table : tables) {
                for(FluxRecord record : table.getRecords()) {
                    String field = record.getField();
                    Double value = (Double) record.getValue();
                    if ("pm2_5".equals(field)) sensor.setPm25(Math.round(value * 100.0) / 100.0);
                    if ("pm10".equals(field)) sensor.setPm10(Math.round(value * 100.0) / 100.0);
                    sensor.setLastReadingTime(record.getTime());
                }
            }
        }

        // Save this live status into Redis for 60 seconds so we don't spam InfluxDB
        redisTemplate.opsForValue().set(liveCacheKey, sensor, 5, TimeUnit.MINUTES);
    }

// ... inside SensorService class ...

    // ==========================================
    // GET SENSORS FOR A SPECIFIC SITE (ROLE-AWARE) - only for government
    // ==========================================
    public List<CompanyDashboardSensorDTO> getSiteSensors(Authentication authentication, Integer siteId) {
        String userEmail = authentication.getName();

        // 1. Check if the user has the "Government" role in their JWT
        boolean isGovernment = authentication.getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_Government") || auth.getAuthority().equals("Government"));

        // Use a different cache key for government so it doesn't cross over with companies
        String metadataCacheKey = "site_metadata:" + siteId + ":" + (isGovernment ? "GOV" : userEmail);

        List<CompanyDashboardSensorDTO> siteSensors = (List<CompanyDashboardSensorDTO>) redisTemplate.opsForValue().get(metadataCacheKey);

        if (siteSensors == null) {
            logs.info("REDIS MISS: Fetching site {} metadata. User: {} | IsGov: {}", siteId, userEmail, isGovernment);

            List<Object[]> results;

            // 2. Route the database query based on their role!
            if (isGovernment) {
                results = registryRepository.findAllSensorsBySiteId(siteId); // Master Key
            } else {
                results = registryRepository.findSensorsBySiteAndEmail(userEmail, siteId); // Restrictive Key
            }

            if (results.isEmpty()) {
                throw new RuntimeException("Site ID " + siteId + " not found or access denied.");
            }

            siteSensors = new ArrayList<>();
            for (Object[] row : results) {
                CompanyDashboardSensorDTO dto = new CompanyDashboardSensorDTO();
                dto.setCompanyName((String) row[0]);
                dto.setSiteName((String) row[1]);
                dto.setSensorId((String) row[2]);
                dto.setLatitude((BigDecimal) row[3]);
                dto.setLongitude((BigDecimal) row[4]);
                dto.setDbStatus((String) row[5]);
                siteSensors.add(dto);
            }

            redisTemplate.opsForValue().set(metadataCacheKey, siteSensors, 24, TimeUnit.HOURS);
        }

        // 3. Loop through and grab the LIVE InfluxDB values
        for (CompanyDashboardSensorDTO sensor : siteSensors) {
            fetchLiveStatus(sensor);
        }

        return siteSensors;
    }

    // public List<SensorInfoDTO> getAllSensorsInfo() {
    //     logs.info("Fetching all the sensors info data");

    //     // Fetch all sensors from PostgreSQL
    //     List<SensorRegistry> sensors = registryRepository.findAll();

    //     // Convert the raw Entities into clean DTOs
    //     return sensors.stream().map(sensor -> new SensorInfoDTO(
    //             sensor.getSensorId(),
    //             sensor.getLocationName(),
    //             sensor.getLatitude(),
    //             sensor.getLongitude(),
    //             sensor.getStatus()
    //     )).collect(Collectors.toList());
    // }

    // //Get by area boundaries
    // public List<SensorInfoDTO> getSensorsWithinArea(BigDecimal minLat, BigDecimal maxLat, BigDecimal minLon, BigDecimal maxLon) {
    //     List<SensorRegistry> sensors = registryRepository.findSensorsWithinBounds(minLat, maxLat, minLon, maxLon);

    //     return sensors.stream().map(sensor -> new SensorInfoDTO(
    //             sensor.getSensorId(),
    //             sensor.getLocationName(),
    //             sensor.getLatitude(),
    //             sensor.getLongitude(),
    //             sensor.getStatus()
    //     )).collect(Collectors.toList());
    // }

    // //Get average for single sensor
    // public SensorAverageDTO getRealTimeAverage(String sensorId) {
    //     logs.info("Requesting real-time average for sensor: {}", sensorId);
    //     String redisKey = "sensor_avg:" + sensorId;

    //     // Check Redis first
    //     SensorAverageDTO cachedData = (SensorAverageDTO) redisTemplate.opsForValue().get(redisKey);
    //     if (cachedData != null) {
    //         logs.info("REDIS HIT: Returning cached data for sensor: {}", sensorId);
    //         return cachedData;
    //     }

    //     logs.info("REDIS MISS: Fetching fresh data from InfluxDB for sensor: {}", sensorId);

    //     // Not in Redis -> Fetch UUID from PostgreSQL
    //     SensorRegistry registry = registryRepository.findBySensorId(sensorId)
    //             .orElseThrow(() -> {
    //                 logs.error("Sensor ID not found in PostgreSQL: {}", sensorId);
    //                 return new RuntimeException("Sensor not found in database: " + sensorId);
    //             });

    //     String influxUuid = registry.getId().toString();

    //     // Query InfluxDB
    //     String fluxQuery = String.format(
    //             "from(bucket:\"%s\") " +
    //                     "|> range(start: -15m) " +
    //                     "|> filter(fn: (r) => r._measurement == \"air_quality\") " +
    //                     "|> filter(fn: (r) => r.sensor_id == \"%s\") " +
    //                     "|> mean()", bucket, influxUuid
    //     );

    //     List<FluxTable> tables = influxDBClient.getQueryApi().query(fluxQuery, org);

    //     SensorAverageDTO dto = new SensorAverageDTO();
    //     dto.setSensorId(sensorId);
    //     dto.setLocationName(registry.getLocationName());
    //     dto.setLastCalculated(Instant.now());

    //     for (FluxTable table : tables) {
    //         for (FluxRecord record : table.getRecords()) {
    //             String field = record.getField();
    //             Double avgValue = (Double) record.getValue();

    //             if (avgValue != null) {
    //                 if ("pm2_5".equals(field)) {
    //                     dto.setPm25(Math.round(avgValue * 100.0) / 100.0);
    //                 } else if ("pm10".equals(field)) {
    //                     dto.setPm10(Math.round(avgValue * 100.0) / 100.0);
    //                 }
    //             }
    //         }
    //     }

    //     // Save to Redis for 10 minutes
    //     logs.info("Caching calculated average in Redis for 10 minutes for sensor: {}", sensorId);
    //     redisTemplate.opsForValue().set(redisKey, dto, 10, TimeUnit.MINUTES);

    //     return dto;
    // }

    // //get the average in a specific area
    // public List<SensorAverageDTO> getRealTimeAveragesInArea(BigDecimal minLat, BigDecimal maxLat, BigDecimal minLon, BigDecimal maxLon) {
    //     logs.info("Fetching real-time averages for map area [MinLat: {}, MaxLat: {}, MinLon: {}, MaxLon: {}]", minLat, maxLat, minLon, maxLon);

    //     // Find which sensors are in the area
    //     List<SensorRegistry> sensorsInArea = registryRepository.findSensorsWithinBounds(minLat, maxLat, minLon, maxLon);

    //     logs.info("Found {} sensors physically located in this bounding box.", sensorsInArea.size());

    //     // Loop through them (this will trigger the Redis hit/miss logs for each individual sensor!)
    //     return sensorsInArea.stream()
    //             .map(sensor -> getRealTimeAverage(sensor.getSensorId()))
    //             .collect(Collectors.toList());
    // }

    // // clustering area sensor function
    // public List<ClusterAverageDTO> getClusteredAveragesInArea(
    //         BigDecimal minLat, BigDecimal maxLat, BigDecimal minLon, BigDecimal maxLon, int rows, int cols) {

    //     logs.info("Clustering map area into {}x{} grid", rows, cols);

    //     //  Get all sensors in the view (Fast DB query)
    //     List<SensorRegistry> sensorsInArea = registryRepository.findSensorsWithinBounds(minLat, maxLat, minLon, maxLon);

    //     if (sensorsInArea.isEmpty()) {
    //         return new ArrayList<>();
    //     }

    //     // Calculate the physical size of each grid cell
    //     double latStep = (maxLat.doubleValue() - minLat.doubleValue()) / rows;
    //     double lonStep = (maxLon.doubleValue() - minLon.doubleValue()) / cols;

    //     // Map to hold our grouped data. Key: "rowIndex_colIndex"
    //     Map<String, List<SensorAverageDTO>> gridMap = new HashMap<>();

    //     // Assign each sensor to a grid cell
    //     for (SensorRegistry sensor : sensorsInArea) {
    //         // Get the ultra-fast cached real-time data
    //         SensorAverageDTO liveData = getRealTimeAverage(sensor.getSensorId());

    //         if (liveData.getPm25() == null) continue; // Skip sensors currently offline/missing data

    //         // Determine which row and column this sensor falls into
    //         int rowIndex = (int) ((sensor.getLatitude().doubleValue() - minLat.doubleValue()) / latStep);
    //         int colIndex = (int) ((sensor.getLongitude().doubleValue() - minLon.doubleValue()) / lonStep);

    //         // Edge case: clamp to max index if it lands perfectly on the boundary
    //         rowIndex = Math.min(rowIndex, rows - 1);
    //         colIndex = Math.min(colIndex, cols - 1);

    //         String cellKey = rowIndex + "_" + colIndex;
    //         gridMap.computeIfAbsent(cellKey, k -> new ArrayList<>()).add(liveData);
    //     }

    //     // Calculate the averages for each populated cell
    //     List<ClusterAverageDTO> clusteredResults = new ArrayList<>();

    //     for (Map.Entry<String, List<SensorAverageDTO>> entry : gridMap.entrySet()) {
    //         String[] indices = entry.getKey().split("_");
    //         int rowIndex = Integer.parseInt(indices[0]);
    //         int colIndex = Integer.parseInt(indices[1]);

    //         List<SensorAverageDTO> cellSensors = entry.getValue();

    //         // Calculate the exact center coordinate of this grid box for the frontend to place the marker
    //         double centerLat = minLat.doubleValue() + (rowIndex + 0.5) * latStep;
    //         double centerLon = minLon.doubleValue() + (colIndex + 0.5) * lonStep;

    //         // Average the PM values
    //         double sumPm25 = 0;
    //         double sumPm10 = 0;
    //         for (SensorAverageDTO data : cellSensors) {
    //             sumPm25 += data.getPm25() != null ? data.getPm25() : 0;
    //             sumPm10 += data.getPm10() != null ? data.getPm10() : 0;
    //         }

    //         double avgPm25 = Math.round((sumPm25 / cellSensors.size()) * 100.0) / 100.0;
    //         double avgPm10 = Math.round((sumPm10 / cellSensors.size()) * 100.0) / 100.0;

    //         clusteredResults.add(new ClusterAverageDTO(
    //                 BigDecimal.valueOf(centerLat),
    //                 BigDecimal.valueOf(centerLon),
    //                 avgPm25,
    //                 avgPm10,
    //                 cellSensors.size()
    //         ));
    //     }

    //     logs.info("Reduced {} raw sensors into {} clean map clusters.", sensorsInArea.size(), clusteredResults.size());
    //     return clusteredResults;
    // }

    // public List<SensorDataWithLocationDTO> searchSensorsByLocation(String locationName) {
    //     logs.info("Searching for sensors matching location: {}", locationName);

    //     // 1. Fetch matching database records
    //     List<SensorRegistry> matchingSensors = registryRepository.findByLocationNameContainingIgnoreCase(locationName);

    //     List<SensorDataWithLocationDTO> combinedResults = new ArrayList<>();

    //     // 2. Loop through and bundle the metadata with the live Redis/Influx data
    //     for (SensorRegistry sensor : matchingSensors) {

    //         // Convert the DB entity into your existing SensorInfoDTO
    //         SensorInfoDTO infoDTO = new SensorInfoDTO(
    //                 sensor.getSensorId(),
    //                 sensor.getLocationName(),
    //                 sensor.getLatitude(),
    //                 sensor.getLongitude(),
    //                 sensor.getStatus()
    //         );

    //         // Fetch the fast live reading (this is your existing method!)
    //         SensorAverageDTO liveData = getRealTimeAverage(sensor.getSensorId());

    //         // Bundle them together
    //         combinedResults.add(new SensorDataWithLocationDTO(infoDTO, liveData));
    //     }

    //     logs.info("Search complete. Found {} sensors.", combinedResults.size());
    //     return combinedResults;
    // }

    // public SensorInfoDTO registerNewSensor(SensorRegistrationDTO dto) {
    //     logs.info("Attempting to register new sensor: {}", dto.getSensorId());

    //     // 1. (Optional but recommended) Check if the sensor ID already exists
    //     Optional<SensorRegistry> existingSensor = registryRepository.findBySensorId(dto.getSensorId());

    //     if (existingSensor.isPresent()) {
    //         throw new RuntimeException("A sensor with ID " + dto.getSensorId() + " is already registered!");
    //     }

    //     // 2. Create a new Database Entity
    //     SensorRegistry newSensor = new SensorRegistry();
    //     newSensor.setSensorId(dto.getSensorId());
    //     newSensor.setLocationName(dto.getLocationName());
    //     newSensor.setLatitude(dto.getLatitude());
    //     newSensor.setLongitude(dto.getLongitude());
    //     newSensor.setStatus("ACTIVE"); // Default to ACTIVE upon registration

    //     // 3. Save it to PostgreSQL
    //     SensorRegistry savedSensor = registryRepository.save(newSensor);
    //     logs.info("Successfully registered sensor {} at {}", savedSensor.getSensorId(), savedSensor.getLocationName());

    //     // 4. Return it as a DTO to the frontend so they know it succeeded
    //     return new SensorInfoDTO(
    //             savedSensor.getSensorId(),
    //             savedSensor.getLocationName(),
    //             savedSensor.getLatitude(),
    //             savedSensor.getLongitude(),
    //             savedSensor.getStatus()
    //     );
    // }

    // public void deleteSensor(String sensorId) {
    //     logs.info("🗑Attempting to delete sensor: {}", sensorId);

    //     // 1. Check if the sensor actually exists first
    //     if (!registryRepository.existsBySensorId(sensorId)) {
    //         throw new RuntimeException("Sensor with ID " + sensorId + " not found!");
    //     }

    //     // 2. Delete it from the PostgreSQL database
    //     registryRepository.deleteBySensorId(sensorId);

    //     logs.info("Successfully deleted sensor: {}", sensorId);
    // }
}