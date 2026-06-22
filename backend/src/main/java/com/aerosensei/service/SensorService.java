package com.aerosensei.service;

import com.aerosensei.dto.*;
import com.aerosensei.enums.PMBreachType;
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

import com.aerosensei.enums.SiteState;
import com.aerosensei.entity.SensorRegistry;
import com.aerosensei.entity.CompanySite;
import com.aerosensei.repository.SensorRegistryRepository;
import com.aerosensei.repository.CompanySiteRepository;


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
    // GET 15-MINUTE READINGS FOR ALL SENSORS AT A SITE
    // ==========================================
    public List<SiteSensor15MinDTO> getSiteSensors15MinReadings(Integer siteId, Authentication authentication) {
        String userEmail = authentication.getName();

        // 1. Check Role
        boolean isGovernment = authentication.getAuthorities().stream()
                .map(auth -> auth.getAuthority().toUpperCase())
                .anyMatch(role -> role.equals("GOVERNMENT") || role.equals("ROLE_GOVERNMENT"));

        // 2. Fetch the metadata array based on role (reusing your existing repository queries!)
        List<Object[]> results;

        if (siteId.equals(-1)) {
            logs.info("Fetching 15m readings for Site: All | User: {} | isGov: {}", userEmail, isGovernment);
            if (isGovernment) {
                results = registryRepository.findAllSensorsDetails();
            } else {
                results = registryRepository.findSensorsDetailsByEmail(userEmail);
            }
        } else {
            logs.info("Fetching 15m readings for Site: {} | User: {} | isGov: {}", siteId, userEmail, isGovernment);
            if (isGovernment) {
                results = registryRepository.findAllSensorsBySiteId(siteId);
            } else {
                results = registryRepository.findSensorsBySiteAndEmail(userEmail, siteId);
            }
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
            SensorReadingsDTO readings15m = getRealTimeReadings(dto.getSensorId());

            dto.setAvgPm25(readings15m.getAvgPm25());
            dto.setAvgPm10(readings15m.getAvgPm10());
            dto.setMaxPm25(readings15m.getMaxPm25());
            dto.setMaxPm10(readings15m.getMaxPm10());
            dto.setBreachType(readings15m.getBreachType());
            dto.setState(readings15m.getState());
            dto.setLastCalculated(readings15m.getLastCalculated());

            responseList.add(dto);
        }

        return responseList;
    }

    // clustering area sensor function
    public List<ClusterMaxDTO>  getClusteredMaxInArea(
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

        // Calculate the centroids and maximums for each cluster
        List<ClusterMaxDTO> clusteredResults = new ArrayList<>();

        for (Map.Entry<String, List<SensorRegistry>> entry : clusteredSensors.entrySet()) {
            List<SensorRegistry> cellSensors = entry.getValue();

            // Used for calculating the physical centroid
            double sumLat = 0;
            double sumLon = 0;

            // Track the maximum PM values in this cluster
            double maxAvgPm25 = -1.0;
            double maxAvgPm10 = -1.0;

            // Track the absolute worst-case peaks
            double absolutePeakPm25 = -1.0;
            double absolutePeakPm10 = -1.0;

            SiteState clusterState = SiteState.SAFE;

            Set<PMBreachType> clusterBreachTypes = new HashSet<>();

            int validSensorCount = 0;

            for (SensorRegistry sensor : cellSensors) {
                // Get the ultra-fast cached real-time data
                SensorReadingsDTO liveData = getRealTimeReadings(sensor.getSensorId());

                if (liveData.getAvgPm25() == null) continue; // Skip offline sensors

                // Sum up ACTUAL coordinates for the centroid calculation
                sumLat += sensor.getLatitude().doubleValue();
                sumLon += sensor.getLongitude().doubleValue();

                // 1. Find the highest sustained average in this cluster
                maxAvgPm25 = Math.max(maxAvgPm25, liveData.getAvgPm25());
                maxAvgPm10 = Math.max(maxAvgPm10, liveData.getAvgPm10());

                // 2. Find the highest absolute peak in this cluster
                absolutePeakPm25 = Math.max(absolutePeakPm25, liveData.getMaxPm25());
                absolutePeakPm10 = Math.max(absolutePeakPm10, liveData.getMaxPm10());

                // 3. Escalate the cluster state based on the worst sensor
                if (liveData.getState() == SiteState.BREACHED) {
                    clusterState = SiteState.BREACHED;
                } else if (liveData.getState() == SiteState.WARNING && clusterState != SiteState.BREACHED) {
                    clusterState = SiteState.WARNING;
                }

                PMBreachType sensorBreach = liveData.getBreachType();
                if (sensorBreach != null && sensorBreach != PMBreachType.NONE) {
                    // Deconstruct MULTIPLE into its base components
                    if (sensorBreach == PMBreachType.MULTIPLE) {
                        clusterBreachTypes.add(PMBreachType.PM2_5);
                        clusterBreachTypes.add(PMBreachType.PM10);
                    } else {
                        clusterBreachTypes.add(sensorBreach);
                    }
                }

                validSensorCount++;
            }

            // If all sensors in this cluster were offline, skip it entirely
            if (validSensorCount == 0) continue;

            // CALCULATE CENTROIDS (Average of all valid sensor coordinates)
            double centroidLat = sumLat / validSensorCount;
            double centroidLon = sumLon / validSensorCount;

            // Round the maximum values to 2 decimal places
            double finalMaxAvgPm25 = Math.round(maxAvgPm25 * 100.0) / 100.0;
            double finalMaxAvgPm10 = Math.round(maxAvgPm10 * 100.0) / 100.0;
            double finalMaxPeakPm25 = Math.round(absolutePeakPm25 * 100.0) / 100.0;
            double finalMaxPeakPm10 = Math.round(absolutePeakPm10 * 100.0) / 100.0;

            PMBreachType finalBreachType = PMBreachType.NONE;
            if (clusterBreachTypes.size() > 1) {
                finalBreachType = PMBreachType.MULTIPLE;
            } else if (clusterBreachTypes.size() == 1) {
                finalBreachType = clusterBreachTypes.iterator().next();
            }

            // Pass the calculated clusterState into the new DTO
            ClusterMaxDTO clusterMax = new ClusterMaxDTO();
            clusterMax.setCenterLat(BigDecimal.valueOf(centroidLat));
            clusterMax.setCenterLon(BigDecimal.valueOf(centroidLon));
            clusterMax.setMaxAvgPm25(finalMaxAvgPm25);
            clusterMax.setMaxAvgPm10(finalMaxAvgPm10);
            clusterMax.setMaxPeakPm25(finalMaxPeakPm25);
            clusterMax.setMaxPeakPm10(finalMaxPeakPm10);
            clusterMax.setBreachType(finalBreachType);
            clusterMax.setState(clusterState);
            clusterMax.setSensorCount(validSensorCount);

            clusteredResults.add(clusterMax);
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
     public SensorReadingsDTO getRealTimeReadings(String sensorId) {
         logs.info("Requesting real-time average for sensor: {}", sensorId);
         String redisKey = "sensor_state:" + sensorId;

         // Check Redis first
         SensorReadingsDTO cachedData = (SensorReadingsDTO) redisTemplate.opsForValue().get(redisKey);
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
                 "data = from(bucket:\"%s\") " +
                         "  |> range(start: -15m) " +
                         "  |> filter(fn: (r) => r._measurement == \"air_quality\") " +
                         "  |> filter(fn: (r) => r.sensor_id == \"%s\") \n" +
                         "data |> mean() |> yield(name: \"mean_val\") \n" +
                         "data |> max() |> yield(name: \"max_val\")",
                 bucket, influxUuid
         );

         List<FluxTable> tables = influxDBClient.getQueryApi().query(fluxQuery, org);

         SensorReadingsDTO dto = new SensorReadingsDTO();
         dto.setSensorId(sensorId);
         dto.setLocationName(registry.getSite().getSiteName());
         dto.setLastCalculated(Instant.now());

         for (FluxTable table : tables) {
             for (FluxRecord record : table.getRecords()) {
                 String field = record.getField();
                 Double value = (Double) record.getValue();
                 String resultType = (String) record.getValueByKey("result");

                 if (value != null) {
                     if ("mean_val".equals(resultType)) {
                         if ("pm2_5".equals(field)) dto.setAvgPm25(value);
                         if ("pm10".equals(field)) dto.setAvgPm10(value);
                     } else if ("max_val".equals(resultType)) {
                         if ("pm2_5".equals(field)) dto.setMaxPm25(value);
                         if ("pm10".equals(field)) dto.setMaxPm10(value);
                     }
                 }
             }
         }

         SiteState pm25State = SiteState.SAFE;
         SiteState pm10State = SiteState.SAFE;

         if (dto.getAvgPm25() != null && dto.getMaxPm25() != null) {
             if (dto.getMaxPm25() >= 50.0 || dto.getAvgPm25() > 40.0) {
                 pm25State = SiteState.BREACHED;
             } else if (dto.getAvgPm25() >= 30.0) {
                 pm25State = SiteState.WARNING;
             }
         }

         if (dto.getAvgPm10() != null && dto.getMaxPm10() != null) {
             if (dto.getMaxPm10() >= 100.0 || dto.getAvgPm10() > 75.0) {
                 pm10State = SiteState.BREACHED;
             } else if (dto.getAvgPm10() >= 50.0) {
                 pm10State = SiteState.WARNING;
             }
         }

         // 4. Determine the Overall Worst-Case State
         if (pm25State == SiteState.BREACHED || pm10State == SiteState.BREACHED) {
             dto.setState(SiteState.BREACHED);
         } else if (pm25State == SiteState.WARNING || pm10State == SiteState.WARNING) {
             dto.setState(SiteState.WARNING);
         } else {
             dto.setState(SiteState.SAFE);
         }

         boolean hasPm25Issue = (pm25State != SiteState.SAFE);
         boolean hasPm10Issue = (pm10State != SiteState.SAFE);

         if (hasPm25Issue && hasPm10Issue) {
             dto.setBreachType(PMBreachType.MULTIPLE);
         } else if (hasPm25Issue) {
             dto.setBreachType(PMBreachType.PM2_5);
         } else if (hasPm10Issue) {
             dto.setBreachType(PMBreachType.PM10);
         } else {
             dto.setBreachType(PMBreachType.NONE);
         }

         if (dto.getAvgPm25() != null) dto.setAvgPm25(Math.round(dto.getAvgPm25() * 100.0) / 100.0);
         if (dto.getAvgPm10() != null) dto.setAvgPm10(Math.round(dto.getAvgPm10() * 100.0) / 100.0);
         if (dto.getMaxPm25() != null) dto.setMaxPm25(Math.round(dto.getMaxPm25() * 100.0) / 100.0);
         if (dto.getMaxPm10() != null) dto.setMaxPm10(Math.round(dto.getMaxPm10() * 100.0) / 100.0);

         // Save to Redis for 10 minutes (avoids spam + stale data)
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

    // ==========================================
    // GET MACRO DIGEST DATA
    // ==========================================
    public MacroDigestDTO getMacroDigest(Authentication authentication) {
        String userEmail = authentication.getName();
        boolean isGovernment = authentication.getAuthorities().stream()
                .map(auth -> auth.getAuthority().toUpperCase())
                .anyMatch(role -> role.equals("GOVERNMENT") || role.equals("ROLE_GOVERNMENT"));

        List<SensorRegistry> allSensors;
        if (isGovernment) {
            allSensors = registryRepository.findAllSensors();
        } else {
            allSensors = registryRepository.findAllCompanySensorsByEmail(userEmail);
        }

        int totalSites = 0;
        int warnings = 0;
        int breaches = 0;

        for (SensorRegistry sensor : allSensors) {
            SensorReadingsDTO liveData = getRealTimeReadings(sensor.getSensorId());

            if (liveData.getAvgPm25() == null) continue; // Skip offline sensors

            totalSites++;

            if (liveData.getState() == SiteState.BREACHED) {
                breaches++;
            } else if (liveData.getState() == SiteState.WARNING) {
                warnings++;
            }
        }

        return new MacroDigestDTO(totalSites, warnings, breaches);
    }

    // ==========================================
    // GET TOP N CRITICAL SENSORS
    // ==========================================
    public List<SensorReadingsDTO> getCriticalReadings(int topN, Authentication authentication) {
        String userEmail = authentication.getName();
        boolean isGovernment = authentication.getAuthorities().stream()
                .map(auth -> auth.getAuthority().toUpperCase())
                .anyMatch(role -> role.equals("GOVERNMENT") || role.equals("ROLE_GOVERNMENT"));

        List<SensorRegistry> allSensors;
        if (isGovernment) {
            allSensors = registryRepository.findAllSensors();
        } else {
            allSensors = registryRepository.findAllCompanySensorsByEmail(userEmail);
        }

        if (allSensors.isEmpty()) {
            return new ArrayList<>();
        }

        return allSensors.stream()
                // Fetch the live data (hits Redis cache instantly for most)
                .map(sensor -> getRealTimeReadings(sensor.getSensorId()))
                // Filter out offline sensors
                .filter(readings -> readings.getAvgPm25() != null)
                // Sort using our Tri-Level Escalation Logic
                .sorted((a, b) -> {
                    // Tie-Breaker 1: Site State (BREACHED > WARNING > SAFE)
                    int stateCompare = Integer.compare(getSeverityScore(b.getState()), getSeverityScore(a.getState()));
                    if (stateCompare != 0) return stateCompare;

                    // Tie-Breaker 2: Breach Type (MULTIPLE > Single > NONE)
                    int typeCompare = Integer.compare(getTypeScore(b.getBreachType()), getTypeScore(a.getBreachType()));
                    if (typeCompare != 0) return typeCompare;

                    // Tie-Breaker 3: Severity Percentage (Calculated on the fly)
                    return Double.compare(calculateDynamicSeverity(b), calculateDynamicSeverity(a));
                })
                // Grab only the Top N most critical globally
                .limit(topN)
                .collect(Collectors.toList());
    }

    // Helper Methods for getCriticalReadings()
    private double calculateDynamicSeverity(SensorReadingsDTO dto) {
        double pm25Severity = 0.0;
        if (dto.getAvgPm25() != null && dto.getMaxPm25() != null) {
            pm25Severity = Math.max(dto.getAvgPm25() / 40.0, dto.getMaxPm25() / 50.0);
        }

        double pm10Severity = 0.0;
        if (dto.getAvgPm10() != null && dto.getMaxPm10() != null) {
            pm10Severity = Math.max(dto.getAvgPm10() / 75.0, dto.getMaxPm10() / 100.0);
        }

        return Math.max(pm25Severity, pm10Severity);
    }

    private int getSeverityScore(SiteState state) {
        if (state == null) return 0;
        switch (state) {
            case BREACHED: return 3;
            case WARNING: return 2;
            case SAFE: return 1;
            default: return 0;
        }
    }

    private int getTypeScore(PMBreachType type) {
        if (type == null) return 0;
        switch (type) {
            case MULTIPLE: return 3;
            case PM2_5:
            case PM10: return 2;
            case NONE: return 1;
            default: return 0;
        }
    }
}