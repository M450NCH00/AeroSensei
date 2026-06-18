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
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;
import java.util.concurrent.TimeUnit;
import java.time.Instant;

import com.aerosensei.entity.SensorRegistry;
import com.aerosensei.entity.CompanySite;
import com.aerosensei.repository.SensorRegistryRepository;
import com.aerosensei.repository.CompanySiteRepository;
import com.aerosensei.dto.SensorAverageDTO;
import com.aerosensei.dto.ClusterAverageDTO;
import com.aerosensei.dto.CompanyDashboardSensorDTO;
import com.aerosensei.dto.SiteHistoricalDataDTO;
import com.aerosensei.dto.SiteSensor15MinDTO;
import com.aerosensei.dto.SensorRegistrationDTO;



import com.github.davidmoten.geo.GeoHash;

@Service
public class SensorService {

    private static final Logger logs = LoggerFactory.getLogger(SensorService.class);

    @Autowired
    private InfluxDBClient influxDBClient;

    @Autowired
    private SensorRegistryRepository registryRepository;

    @Autowired
    private CompanySiteRepository companySiteRepository;

    //redis properties
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    //influxdb properties
    @Value("${influxdb.org}")
    private String org;

    @Value("${influxdb.bucket}")
    private String bucket;

//    // ==========================================
//    // GET COMPANY DASHBOARD (DOUBLE CACHE)
//    // ==========================================
//    public List<CompanyDashboardSensorDTO> getCompanyDashboard(String userEmail) {
//        String metadataCacheKey = "company_metadata:" + userEmail;
//
//        // CACHE 1: Check Redis for the heavy PostgreSQL Metadata (lasts 24 hours)
//        List<CompanyDashboardSensorDTO> dashboardSensors = (List<CompanyDashboardSensorDTO>) redisTemplate.opsForValue().get(metadataCacheKey);
//
//        if (dashboardSensors == null) {
//            logs.info("REDIS MISS: Fetching company metadata from DB for user: {}", userEmail);
//            List<Object[]> results = registryRepository.findCompanySensorMetadataByEmail(userEmail);
//
//            dashboardSensors = new ArrayList<>();
//            for (Object[] row : results) {
//                CompanyDashboardSensorDTO dto = new CompanyDashboardSensorDTO();
//                dto.setCompanyName((String) row[0]);
//                dto.setSiteName((String) row[1]);
//                dto.setSensorId((String) row[2]);
//                dto.setLatitude((BigDecimal) row[3]);
//                dto.setLongitude((BigDecimal) row[4]);
//                dto.setDbStatus((String) row[5]);
//                dashboardSensors.add(dto);
//            }
//            // Save metadata to Redis
//            if (!dashboardSensors.isEmpty()) {
//                redisTemplate.opsForValue().set(metadataCacheKey, dashboardSensors, 24, TimeUnit.HOURS);
//            }
//        }
//
//        // CACHE 2: Check live InfluxDB data for the 1-Hour Online Status
//        for (CompanyDashboardSensorDTO sensor : dashboardSensors) {
//            fetchLiveStatus(sensor);
//        }
//
//        return dashboardSensors;
//    }

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

    // ==========================================
    // GET 15-MINUTE AVERAGE FOR ALL SENSORS AT A SITE
    // ==========================================
    public List<SiteSensor15MinDTO> getSiteSensors15MinAverage(Integer siteId, Authentication authentication) {
        String userEmail = authentication.getName();

        // 1. Check Role
        boolean isGovernment = authentication.getAuthorities().stream()
                .map(auth -> auth.getAuthority().toUpperCase())
                .anyMatch(role -> role.equals("GOVERNMENT") || role.equals("ROLE_GOVERNMENT"));

        logs.info("Fetching 15m averages for Site: {} | User: {} | isGov: {}", siteId, userEmail, isGovernment);

        // 2. Fetch the metadata array based on role (reusing your existing repository queries!)
        List<Object[]> results;
        if (isGovernment) {
            results = registryRepository.findAllSensorsBySiteId(siteId);
        } else {
            results = registryRepository.findSensorsBySiteAndEmail(userEmail, siteId);
        }

        // 3. Map the data and fetch the cached 15-min averages
        List<SiteSensor15MinDTO> responseList = new ArrayList<>();

        for (Object[] row : results) {
            SiteSensor15MinDTO dto = new SiteSensor15MinDTO();
            dto.setCompanyName((String) row[0]);
            dto.setSiteName((String) row[1]);
            dto.setSensorId((String) row[2]);
            dto.setLatitude((BigDecimal) row[3]);
            dto.setLongitude((BigDecimal) row[4]);
            dto.setStatus((String) row[5]);

            // This is super fast because it hits your 10-minute Redis cache first.
            SensorAverageDTO avg15m = getRealTimeAverage(dto.getSensorId());

            dto.setPm25(avg15m.getPm25());
            dto.setPm10(avg15m.getPm10());
            dto.setLastCalculated(avg15m.getLastCalculated());

            responseList.add(dto);
        }

        return responseList;
    }

    // clustering area sensor function
    public List<ClusterAverageDTO>  getClusteredAveragesInArea(
            BigDecimal minLat, BigDecimal maxLat, BigDecimal minLon, BigDecimal maxLon, int zoom, Authentication authentication) {

        //Identify who is asking
        String userEmail = authentication.getName();
        boolean isGovernment = authentication.getAuthorities().stream()
                .map(auth -> auth.getAuthority().toUpperCase()) // Convert everything to uppercase
                .anyMatch(role -> role.equals("GOVERNMENT") || role.equals("ROLE_GOVERNMENT"));

        logs.info("Government checking: {}", isGovernment);

        // Translate the map zoom into a database string prefix length
        int precision = mapZoomToPrecision(zoom);
        logs.info("Clustering map area using zoom level {} -> geohash precision {}", zoom, precision);

        // Get all sensors in the view (Fast DB query)
        List<SensorRegistry> sensorsInArea;

        if (isGovernment) {
            // Government sees every sensor inside the map bounds
            sensorsInArea = registryRepository.findSensorsWithinBounds(minLat, maxLat, minLon, maxLon);
        } else {
            // Company sees ONLY their own sensors inside the map bounds
            sensorsInArea = registryRepository.findCompanySensorsWithinBounds(minLat, maxLat, minLon, maxLon, userEmail);
        }

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

    // ==========================================
    // GET 12-HOUR HISTORICAL AVERAGE FOR A SITE
    // ==========================================
    public List<SiteHistoricalDataDTO> getSiteHistoricalAverage(Integer siteId, Authentication authentication) {
        String userEmail = authentication.getName();
        boolean isGovernment = authentication.getAuthorities().stream()
                .map(auth -> auth.getAuthority().toUpperCase())
                .anyMatch(role -> role.equals("GOVERNMENT") || role.equals("ROLE_GOVERNMENT"));

        // Fetch allowed UUIDs from PostgreSQL based on role
        List<String> sensorUuids;
        if (isGovernment) {
            sensorUuids = registryRepository.findSensorUuidsBySiteId(siteId);
        } else {
            sensorUuids = registryRepository.findSensorUuidsBySiteIdAndEmail(siteId, userEmail);
        }

        // If the site doesn't exist, doesn't belong to the company, or has no sensors -> return empty
        if (sensorUuids == null || sensorUuids.isEmpty()) {
            return new ArrayList<>();
        }

        // Build the dynamic Flux filter string for the UUIDs
        // Result looks like: r.sensor_id == "uuid1" or r.sensor_id == "uuid2"
        String uuidFilter = sensorUuids.stream()
                .map(uuid -> "r.sensor_id == \"" + uuid + "\"")
                .collect(Collectors.joining(" or "));

        // The 12-Hour InfluxDB Query
        // group(columns: ["_field"]) pools all sensors at the site together before averaging
        String fluxQuery = String.format(
                "from(bucket:\"%s\") " +
                        "|> range(start: -12h) " +
                        "|> filter(fn: (r) => r._measurement == \"air_quality\") " +
                        "|> filter(fn: (r) => %s) " +
                        "|> group(columns: [\"_field\"]) " +
                        "|> aggregateWindow(every: 1h, fn: mean, createEmpty: false)",
                bucket, uuidFilter
        );

        logs.info("Executing 12-hour historical query for site {}. Sensors involved: {}", siteId, sensorUuids.size());
        List<FluxTable> tables = influxDBClient.getQueryApi().query(fluxQuery, org);

        // 4. Map the results by Timestamp so PM2.5 and PM10 merge into the same DTO
        Map<Instant, SiteHistoricalDataDTO> timeSeriesMap = new HashMap<>();

        for (FluxTable table : tables) {
            for (FluxRecord record : table.getRecords()) {
                Instant time = record.getTime();
                String field = record.getField();
                Double value = (Double) record.getValue();

                if (value == null) continue;

                // Create or fetch the DTO for this specific hour
                SiteHistoricalDataDTO dto = timeSeriesMap.computeIfAbsent(time, SiteHistoricalDataDTO::new);

                if ("pm2_5".equals(field)) {
                    dto.setPm25(Math.round(value * 100.0) / 100.0);
                } else if ("pm10".equals(field)) {
                    dto.setPm10(Math.round(value * 100.0) / 100.0);
                }
            }
        }

        // 5. Convert map to a sorted list (oldest to newest) for graphing
        List<SiteHistoricalDataDTO> sortedData = new ArrayList<>(timeSeriesMap.values());
        sortedData.sort(Comparator.comparing(SiteHistoricalDataDTO::getTimestamp));

        return sortedData;
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
         dto.setLocationName(registry.getSite().getSiteName());
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

    // ==========================================
    // REGISTER A NEW SENSOR
    // ==========================================
    @Transactional
    public SensorRegistry registerSensor(SensorRegistrationDTO dto, Authentication authentication) {
        String userEmail = authentication.getName();
        boolean isGovernment = authentication.getAuthorities().stream()
                .map(auth -> auth.getAuthority().toUpperCase())
                .anyMatch(role -> role.equals("GOVERNMENT") || role.equals("ROLE_GOVERNMENT"));

        // 1. Check if the Sensor ID is already taken
        if (registryRepository.existsBySensorId(dto.getSensorId())) {
            throw new RuntimeException("Sensor ID '" + dto.getSensorId() + "' is already registered.");
        }

        // 2. Verify Ownership (Government skips this check)
        if (!isGovernment) {
            boolean ownsSite = registryRepository.existsBySiteIdAndUserEmail(dto.getSiteId(), userEmail);
            if (!ownsSite) {
                throw new RuntimeException("Access Denied: You do not own Site ID " + dto.getSiteId());
            }
        }

        // 3. Fetch the Site Reference
        CompanySite site = companySiteRepository.findById(dto.getSiteId())
                .orElseThrow(() -> new RuntimeException("Site ID not found."));

        // 4. Calculate Geohash automatically (Precision 9 is roughly 4.7m x 4.7m)
        String generatedGeohash = GeoHash.encodeHash(
                dto.getLatitude().doubleValue(),
                dto.getLongitude().doubleValue(),
                9
        );

        // 5. Build and Save the Entity
        SensorRegistry newSensor = new SensorRegistry();
        newSensor.setSensorId(dto.getSensorId());
        newSensor.setSite(site);
        newSensor.setLatitude(dto.getLatitude());
        newSensor.setLongitude(dto.getLongitude());
        newSensor.setGeohash(generatedGeohash);
        newSensor.setStatus("active");
        newSensor.setInstallationDate(java.time.LocalDate.now());

        logs.info("Registering new sensor: {} at site: {} with Geohash: {}", dto.getSensorId(), dto.getSiteId(), generatedGeohash);
        return registryRepository.save(newSensor);
    }

    // ==========================================
    // DELETE A SENSOR
    // ==========================================
    @Transactional
    public void deleteSensor(String sensorId, Authentication authentication) {
        String userEmail = authentication.getName();
        boolean isGovernment = authentication.getAuthorities().stream()
                .map(auth -> auth.getAuthority().toUpperCase())
                .anyMatch(role -> role.equals("GOVERNMENT") || role.equals("ROLE_GOVERNMENT"));

        // 1. Check if sensor exists
        if (!registryRepository.existsBySensorId(sensorId)) {
            throw new RuntimeException("Sensor ID '" + sensorId + "' does not exist.");
        }

        // 2. Verify Ownership (Government skips this check)
        if (!isGovernment) {
            boolean ownsSensor = registryRepository.existsBySensorIdAndUserEmail(sensorId, userEmail);
            if (!ownsSensor) {
                throw new RuntimeException("Access Denied: You do not own Sensor '" + sensorId + "'");
            }
        }

        logs.info("Deleting sensor: {} | User: {}", sensorId, userEmail);
        registryRepository.deleteBySensorId(sensorId);
    }
}