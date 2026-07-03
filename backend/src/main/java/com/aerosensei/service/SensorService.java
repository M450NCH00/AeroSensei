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
    // GET 15-MINUTE READINGS AGGREGATED BY SITE
    // ==========================================
    public List<SiteSensor15MinDTO> getSiteSensors15MinReadings(Integer siteId, Authentication authentication) {
        String userEmail = authentication.getName();

        boolean isGovernment = authentication.getAuthorities().stream()
                .map(auth -> auth.getAuthority().toUpperCase())
                .anyMatch(role -> role.equals("GOVERNMENT") || role.equals("ROLE_GOVERNMENT"));

        List<Object[]> results;
        if (siteId.equals(-1)) {
            logs.info("Fetching 15m readings for Site: All | User: {} | isGov: {}", userEmail, isGovernment);
            results = isGovernment ? registryRepository.findAllSensorsDetails() : registryRepository.findSensorsDetailsByEmail(userEmail);
        } else {
            logs.info("Fetching 15m readings for Site: {} | User: {} | isGov: {}", siteId, userEmail, isGovernment);
            results = isGovernment ? registryRepository.findAllSensorsBySiteId(siteId) : registryRepository.findSensorsBySiteAndEmail(userEmail, siteId);
        }

        // Group the sensors by Site ID (row[1])
        Map<Integer, List<Object[]>> groupedBySite = results.stream()
                .collect(Collectors.groupingBy(row -> (Integer) row[1]));

        List<SiteSensor15MinDTO> responseList = new ArrayList<>();

        // Iterate through each Site and calculate aggregated values
        for (Map.Entry<Integer, List<Object[]>> entry : groupedBySite.entrySet()) {
            List<Object[]> siteSensors = entry.getValue();

            Object[] firstRow = siteSensors.get(0);

            SiteSensor15MinDTO siteDto = new SiteSensor15MinDTO();
            siteDto.setCompanyName((String) firstRow[0]);
            siteDto.setSiteId((Integer) firstRow[1]);
            siteDto.setSiteName((String) firstRow[2]);
            siteDto.setLatitude((BigDecimal) firstRow[4]);
            siteDto.setLongitude((BigDecimal) firstRow[5]);

            double totalAvgPm25 = 0.0, totalAvgPm10 = 0.0;
            double absoluteMaxPm25 = -1.0, absoluteMaxPm10 = -1.0;
            int validPm25Count = 0, validPm10Count = 0;
            Instant latestCalculation = Instant.MIN;

            // Fetch readings for every sensor at this site
            for (Object[] row : siteSensors) {
                String sensorId = (String) row[3];
                SensorReadingsDTO sensorReadings = getRealTimeReadings(sensorId);

                // Accumulate PM 2.5
                if (sensorReadings.getAvgPm25() != null) {
                    totalAvgPm25 += sensorReadings.getAvgPm25();
                    validPm25Count++;
                    if (sensorReadings.getMaxPm25() != null && sensorReadings.getMaxPm25() > absoluteMaxPm25) {
                        absoluteMaxPm25 = sensorReadings.getMaxPm25();
                    }
                }

                // Accumulate PM 10
                if (sensorReadings.getAvgPm10() != null) {
                    totalAvgPm10 += sensorReadings.getAvgPm10();
                    validPm10Count++;
                    if (sensorReadings.getMaxPm10() != null && sensorReadings.getMaxPm10() > absoluteMaxPm10) {
                        absoluteMaxPm10 = sensorReadings.getMaxPm10();
                    }
                }

                if (sensorReadings.getLastCalculated() != null && sensorReadings.getLastCalculated().isAfter(latestCalculation)) {
                    latestCalculation = sensorReadings.getLastCalculated();
                }
            }

            // Calculate Final Site Numbers
            Double finalAvgPm25 = validPm25Count > 0 ? (totalAvgPm25 / validPm25Count) : null;
            Double finalMaxPm25 = validPm25Count > 0 ? absoluteMaxPm25 : null;

            Double finalAvgPm10 = validPm10Count > 0 ? (totalAvgPm10 / validPm10Count) : null;
            Double finalMaxPm10 = validPm10Count > 0 ? absoluteMaxPm10 : null;

            if (finalAvgPm25 != null) siteDto.setAvgPm25(Math.round(finalAvgPm25 * 100.0) / 100.0);
            if (finalMaxPm25 != null) siteDto.setMaxPm25(Math.round(finalMaxPm25 * 100.0) / 100.0);
            if (finalAvgPm10 != null) siteDto.setAvgPm10(Math.round(finalAvgPm10 * 100.0) / 100.0);
            if (finalMaxPm10 != null) siteDto.setMaxPm10(Math.round(finalMaxPm10 * 100.0) / 100.0);

            siteDto.setLastCalculated(latestCalculation == Instant.MIN ? null : latestCalculation);

            // Delegate to the new helper method (only passing averages!)
            determineStateAndBreach(siteDto, finalAvgPm25, finalAvgPm10);

            responseList.add(siteDto);
        }

        return responseList;
    }

    // clustering area sensor function
    public List<ClusterMaxDTO> getClusteredMaxInArea(
            BigDecimal minLat, BigDecimal maxLat, BigDecimal minLon, BigDecimal maxLon, int zoom, Authentication authentication) {

        logs.info("Clustering map area using zoom level {}", zoom);

        // 1. Fetch all aggregated sites
        List<SiteSensor15MinDTO> allSites = getSiteSensors15MinReadings(-1, authentication);

        // 2. Filter sites to ONLY those that are online and within the map bounding box
        List<SiteSensor15MinDTO> sitesInArea = allSites.stream()
                // Keep only online sites
                .filter(site -> site.getAvgPm25() != null || site.getAvgPm10() != null)
                // Keep only sites within the map viewport
                .filter(site -> {
                    double lat = site.getLatitude().doubleValue();
                    double lon = site.getLongitude().doubleValue();
                    return lat >= minLat.doubleValue() && lat <= maxLat.doubleValue() &&
                            lon >= minLon.doubleValue() && lon <= maxLon.doubleValue();
                })
                .collect(Collectors.toList());

        if (sitesInArea.isEmpty()) {
            return new ArrayList<>();
        }

        // Translate the map zoom into a geohash precision length
        int precision = mapZoomToPrecision(zoom);

        // Map to hold our grouped data
        Map<String, List<SiteSensor15MinDTO>> clusteredSites = new HashMap<>();

        // 3. Assign each site to a cluster based on dynamically generated Geohash
        for (SiteSensor15MinDTO site : sitesInArea) {
            String clusterHash = GeoHash.encodeHash(
                    site.getLatitude().doubleValue(),
                    site.getLongitude().doubleValue(),
                    precision
            );
            clusteredSites.computeIfAbsent(clusterHash, k -> new ArrayList<>()).add(site);
        }

        // 4. Calculate the centroids, averages, and peaks for each cluster
        List<ClusterMaxDTO> clusteredResults = new ArrayList<>();

        for (Map.Entry<String, List<SiteSensor15MinDTO>> entry : clusteredSites.entrySet()) {
            List<SiteSensor15MinDTO> cellSites = entry.getValue();

            double sumLat = 0;
            double sumLon = 0;

            // Track the worst-case site average in this cluster
            double maxAvgPm25 = -1.0;
            double maxAvgPm10 = -1.0;

            // Track the absolute worst-case peaks in this cluster
            double absolutePeakPm25 = -1.0;
            double absolutePeakPm10 = -1.0;

            SiteState clusterState = SiteState.SAFE;
            Set<PMBreachType> clusterBreachTypes = new HashSet<>();

            for (SiteSensor15MinDTO site : cellSites) {

                // Sum up coordinates for the centroid calculation
                sumLat += site.getLatitude().doubleValue();
                sumLon += site.getLongitude().doubleValue();

                // Find the highest sustained average among all sites in this cluster
                if (site.getAvgPm25() != null) maxAvgPm25 = Math.max(maxAvgPm25, site.getAvgPm25());
                if (site.getAvgPm10() != null) maxAvgPm10 = Math.max(maxAvgPm10, site.getAvgPm10());

                // Find the highest absolute peak among all sites in this cluster
                if (site.getMaxPm25() != null) absolutePeakPm25 = Math.max(absolutePeakPm25, site.getMaxPm25());
                if (site.getMaxPm10() != null) absolutePeakPm10 = Math.max(absolutePeakPm10, site.getMaxPm10());

                // Escalate the cluster state based on the worst site
                if (site.getState() == SiteState.BREACHED) {
                    clusterState = SiteState.BREACHED;
                } else if (site.getState() == SiteState.WARNING && clusterState != SiteState.BREACHED) {
                    clusterState = SiteState.WARNING;
                }

                // Deconstruct MULTIPLE into its base components
                if (site.getBreachType() != null && site.getBreachType() != PMBreachType.NONE) {
                    if (site.getBreachType() == PMBreachType.MULTIPLE) {
                        clusterBreachTypes.add(PMBreachType.PM2_5);
                        clusterBreachTypes.add(PMBreachType.PM10);
                    } else {
                        clusterBreachTypes.add(site.getBreachType());
                    }
                }
            }

            // CALCULATE CENTROIDS
            int validSiteCount = cellSites.size();
            double centroidLat = sumLat / validSiteCount;
            double centroidLon = sumLon / validSiteCount;

            PMBreachType finalBreachType = PMBreachType.NONE;
            if (clusterBreachTypes.size() > 1) {
                finalBreachType = PMBreachType.MULTIPLE;
            } else if (clusterBreachTypes.size() == 1) {
                finalBreachType = clusterBreachTypes.iterator().next();
            }

            // Determine the dynamic Site Name
            String resolvedSiteName = (validSiteCount == 1) ? cellSites.get(0).getSiteName() : "Regional Area";

            // Build the final DTO
            ClusterMaxDTO clusterMax = new ClusterMaxDTO();
            clusterMax.setSiteName(resolvedSiteName); // Added newly resolved name
            clusterMax.setCenterLat(BigDecimal.valueOf(centroidLat));
            clusterMax.setCenterLon(BigDecimal.valueOf(centroidLon));

            // Averages
            if (maxAvgPm25 >= 0) clusterMax.setMaxAvgPm25(Math.round(maxAvgPm25 * 100.0) / 100.0);
            if (maxAvgPm10 >= 0) clusterMax.setMaxAvgPm10(Math.round(maxAvgPm10 * 100.0) / 100.0);

            // Peaks
            if (absolutePeakPm25 >= 0) clusterMax.setMaxPeakPm25(Math.round(absolutePeakPm25 * 100.0) / 100.0);
            if (absolutePeakPm10 >= 0) clusterMax.setMaxPeakPm10(Math.round(absolutePeakPm10 * 100.0) / 100.0);

            clusterMax.setBreachType(finalBreachType);
            clusterMax.setState(clusterState);
            clusterMax.setSiteCount(validSiteCount);

            clusteredResults.add(clusterMax);
        }

        logs.info("Reduced {} active sites into {} clean map clusters.", sitesInArea.size(), clusteredResults.size());
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

    // ==========================================
    // GET REAL-TIME AVERAGES (SINGLE SENSOR)
    // ==========================================
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

        // Fetch UUID from PostgreSQL
        SensorRegistry registry = registryRepository.findBySensorId(sensorId)
                .orElseThrow(() -> {
                    logs.error("Sensor ID not found in PostgreSQL: {}", sensorId);
                    return new RuntimeException("Sensor not found in database: " + sensorId);
                });

        String influxUuid = registry.getId().toString();

        // Query InfluxDB (Keeping max_val in the query just to populate the DTO fields if the frontend still wants to display them)
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

        // Delegate to the new helper method (only passing averages!)
        determineStateAndBreach(dto, dto.getAvgPm25(), dto.getAvgPm10());

        // Rounding
        if (dto.getAvgPm25() != null) dto.setAvgPm25(Math.round(dto.getAvgPm25() * 100.0) / 100.0);
        if (dto.getAvgPm10() != null) dto.setAvgPm10(Math.round(dto.getAvgPm10() * 100.0) / 100.0);
        if (dto.getMaxPm25() != null) dto.setMaxPm25(Math.round(dto.getMaxPm25() * 100.0) / 100.0);
        if (dto.getMaxPm10() != null) dto.setMaxPm10(Math.round(dto.getMaxPm10() * 100.0) / 100.0);

        // Save to Redis for 1 minute
        logs.info("Caching calculated average in Redis for 1 minute for sensor: {}", sensorId);
        redisTemplate.opsForValue().set(redisKey, dto, 1, TimeUnit.MINUTES);

        return dto;
    }


    // ==========================================
    // PRIVATE HELPER: FETCH FROM DB & UPDATE CACHE
    // ==========================================
    private List<SensorSimpleDTO> refreshSensorsCacheForSite(Integer siteId) {
        logs.info("Fetching fresh sensors from DB and updating cache for Site: {}", siteId);

        // 1. Fetch fresh from DB
        List<Object[]> results = registryRepository.findAllSensorsBySiteId(siteId);
        List<SensorSimpleDTO> responseList = new ArrayList<>();

        for (Object[] row : results) {
            SensorSimpleDTO dto = new SensorSimpleDTO();
            dto.setId((String) row[2]);
            dto.setStatus((String) row[5]);
            responseList.add(dto);
        }

        // 2. Overwrite Redis Cache (15 min TTL)
        String redisKey = "sensors:site:" + siteId;
        redisTemplate.opsForValue().set(redisKey, responseList, 15, TimeUnit.MINUTES);

        return responseList;
    }

    // ==========================================
    // GET ALL SENSORS DETAILS FOR A SITE
    // ==========================================
    @SuppressWarnings("unchecked")
    public List<SensorSimpleDTO> getAllSensorsOfSpecificSite(Integer siteId) {
        String redisKey = "sensors:site:" + siteId;

        // 1. Check Redis first
        List<SensorSimpleDTO> cachedData = (List<SensorSimpleDTO>) redisTemplate.opsForValue().get(redisKey);
        if (cachedData != null) {
            logs.info("REDIS HIT: Returning cached sensors for Site: {}", siteId);
            return cachedData;
        }

        logs.info("REDIS MISS: Cache empty. Delegating to DB fetch for Site: {}", siteId);

        // 2. If miss, fetch from DB and cache it using the helper
        return refreshSensorsCacheForSite(siteId);
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

        // Check if the Sensor ID is already taken
        if (registryRepository.existsBySensorId(dto.getSensorId())) {
            throw new RuntimeException("Sensor ID '" + dto.getSensorId() + "' is already registered.");
        }

        // Verify Ownership (Government skips this check)
        if (!isGovernment) {
            boolean ownsSite = registryRepository.existsBySiteIdAndUserEmail(dto.getSiteId(), userEmail);
            if (!ownsSite) {
                throw new RuntimeException("Access Denied: You do not own Site ID " + dto.getSiteId());
            }
        }

        // Fetch the Site Reference
        CompanySite site = companySiteRepository.findById(dto.getSiteId())
                .orElseThrow(() -> new RuntimeException("Site ID not found."));

        if (dto.getLatitude() == null) {
            logs.info("No latitude provided, proceeding with default site latitude: {}", site.getLatitude());
            dto.setLatitude(site.getLatitude());
        }

        if (dto.getLongitude() == null) {
            logs.info("No longitude provided, proceeding with default site longitude: {}", site.getLongitude());
            dto.setLongitude(site.getLongitude());
        }

        // Calculate Geohash automatically (Precision 9 is roughly 4.7m x 4.7m)
        String generatedGeohash = GeoHash.encodeHash(
                dto.getLatitude().doubleValue(),
                dto.getLongitude().doubleValue(),
                9
        );

        // Build and Save the Entity
        SensorRegistry newSensor = new SensorRegistry();
        newSensor.setSensorId(dto.getSensorId());
        newSensor.setSite(site);
        newSensor.setLatitude(dto.getLatitude());
        newSensor.setLongitude(dto.getLongitude());
        newSensor.setGeohash(generatedGeohash);
        newSensor.setStatus("active");
        newSensor.setInstallationDate(java.time.LocalDate.now());

        logs.info("Registering new sensor: {} at site: {} with Geohash: {}", dto.getSensorId(), dto.getSiteId(), generatedGeohash);
        SensorRegistry savedSensor = registryRepository.save(newSensor);

        // Refresh the list cache for this specific site
        refreshSensorsCacheForSite(dto.getSiteId());

        return savedSensor;
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

        // 1. Fetch the sensor first (we need to know which site it belongs to before we delete it)
        SensorRegistry sensorToDelete = registryRepository.findBySensorId(sensorId) // *See note below*
                .orElseThrow(() -> new RuntimeException("Sensor ID '" + sensorId + "' does not exist."));

        Integer siteId = sensorToDelete.getSite().getId().intValue();

        // 2. Verify Ownership (Government skips this check)
        if (!isGovernment) {
            boolean ownsSensor = registryRepository.existsBySensorIdAndUserEmail(sensorId, userEmail);
            if (!ownsSensor) {
                throw new RuntimeException("Access Denied: You do not own Sensor '" + sensorId + "'");
            }
        }

        logs.info("Deleting sensor: {} | User: {}", sensorId, userEmail);
        registryRepository.deleteBySensorId(sensorId);

        // Refresh the list cache so the deleted sensor is no longer in Redis
        refreshSensorsCacheForSite(siteId);
    }

    // ==========================================
    // GET MACRO DIGEST DATA
    // ==========================================
    public MacroDigestDTO getMacroDigest(Authentication authentication) {
        List<SiteSensor15MinDTO> allSites = getSiteSensors15MinReadings(-1, authentication);

        int totalSites = 0;
        int warnings = 0;
        int breaches = 0;

        for (SiteSensor15MinDTO site : allSites) {
            if (site.getAvgPm25() == null && site.getAvgPm10() == null) {
                continue;
            }

            totalSites++;

            if (site.getState() == SiteState.BREACHED) {
                breaches++;
            } else if (site.getState() == SiteState.WARNING) {
                warnings++;
            }
        }

        return new MacroDigestDTO(totalSites, warnings, breaches);
    }

    // ==========================================
    // CITY-WIDE SENSOR STATE COUNTS (system job, no auth)
    // ==========================================
    /**
     * Classifies every registered sensor by its current 15-minute state and
     * returns {totalWithData, warnings, breaches}. Used by the city-wide ministry
     * escalation job. Sensors with no recent readings are excluded from the total
     * so the fractions reflect only live sensors. Reuses {@link #getRealTimeReadings}
     * (Redis-cached), so the per-sensor state definition stays consistent with the
     * dashboards.
     */
    public int[] getSystemSensorStateCounts() {
        List<Object[]> results = registryRepository.findAllSensorsDetails();
        int total = 0, warnings = 0, breaches = 0;

        for (Object[] row : results) {
            String sensorId = (String) row[3];
            SensorReadingsDTO r;
            try {
                r = getRealTimeReadings(sensorId);
            } catch (Exception e) {
                logs.warn("State count skipped sensor {}: {}", sensorId, e.getMessage());
                continue;
            }
            // No data in the last 15 minutes -> sensor is offline, don't count it.
            if (r.getAvgPm25() == null && r.getAvgPm10() == null) continue;

            total++;
            if (r.getState() == SiteState.BREACHED) {
                breaches++;
            } else if (r.getState() == SiteState.WARNING) {
                warnings++;
            }
        }

        logs.info("City-wide sensor states -> total(live): {}, warnings: {}, breaches: {}", total, warnings, breaches);
        return new int[]{total, warnings, breaches};
    }

    // ==========================================
    // GET TOP N CRITICAL SENSORS
    // ==========================================
    public List<SiteSensor15MinDTO> getCriticalReadings(int topN, Authentication authentication) {
        List<SiteSensor15MinDTO> allSites = getSiteSensors15MinReadings(-1, authentication);

        if (allSites.isEmpty()) {
            return new ArrayList<>();
        }

        return allSites.stream()
                // Filter out offline sites (where no averages could be calculated)
                .filter(site -> site.getAvgPm25() != null || site.getAvgPm10() != null)

                // Sort using our Tri-Level Escalation Logic
                .sorted((a, b) -> {
                    // Tie-Breaker 1: Site State (BREACHED > WARNING > SAFE)
                    int stateCompare = Integer.compare(getSeverityScore(b.getState()), getSeverityScore(a.getState()));
                    if (stateCompare != 0) return stateCompare;

                    // Tie-Breaker 2: Breach Type (MULTIPLE > Single > NONE)
                    int typeCompare = Integer.compare(getTypeScore(b.getBreachType()), getTypeScore(a.getBreachType()));
                    if (typeCompare != 0) return typeCompare;

                    // Tie-Breaker 3: Severity Percentage (Calculated dynamically)
                    return Double.compare(calculateDynamicSeverity(b), calculateDynamicSeverity(a));
                })
                // Grab only the Top N most critical globally
                .limit(topN)
                .collect(Collectors.toList());
    }

    // Helper Methods for getCriticalReadings()
    private double calculateDynamicSeverity(SiteSensor15MinDTO dto) {
        double pm25Severity = 0.0;
        double pm10Severity = 0.0;

        // Calculate percentage towards PM 2.5 Breach Threshold (40.0)
        if (dto.getAvgPm25() != null) {
            pm25Severity = dto.getAvgPm25() / 40.0;
        }

        // Calculate percentage towards PM 10 Breach Threshold (75.0)
        if (dto.getAvgPm10() != null) {
            pm10Severity = dto.getAvgPm10() / 75.0;
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

    // ==========================================
    // HELPERS: CALCULATE STATE & BREACH TYPE (AVG ONLY)
    // ==========================================
    private void determineStateAndBreach(SiteSensor15MinDTO dto, Double avgPm25, Double avgPm10) {
        Object[] states = calculateBreachLogic(avgPm25, avgPm10);
        dto.setState((SiteState) states[0]);
        dto.setBreachType((PMBreachType) states[1]);
    }

    private void determineStateAndBreach(SensorReadingsDTO dto, Double avgPm25, Double avgPm10) {
        Object[] states = calculateBreachLogic(avgPm25, avgPm10);
        dto.setState((SiteState) states[0]);
        dto.setBreachType((PMBreachType) states[1]);
    }


    // The core logic shared by both DTOs
    private Object[] calculateBreachLogic(Double avgPm25, Double avgPm10) {
        SiteState pm25State = SiteState.SAFE;
        SiteState pm10State = SiteState.SAFE;

        // PM 2.5 Logic (Average Only)
        if (avgPm25 != null) {
            if (avgPm25 > 40.0) {
                pm25State = SiteState.BREACHED;
            } else if (avgPm25 >= 30.0) {
                pm25State = SiteState.WARNING;
            }
        }

        // PM 10 Logic (Average Only)
        if (avgPm10 != null) {
            if (avgPm10 > 75.0) {
                pm10State = SiteState.BREACHED;
            } else if (avgPm10 >= 50.0) {
                pm10State = SiteState.WARNING;
            }
        }

        // Determine Overall State
        SiteState finalState = SiteState.SAFE;
        if (pm25State == SiteState.BREACHED || pm10State == SiteState.BREACHED) {
            finalState = SiteState.BREACHED;
        } else if (pm25State == SiteState.WARNING || pm10State == SiteState.WARNING) {
            finalState = SiteState.WARNING;
        }

        // Determine Breach Type
        PMBreachType breachType = PMBreachType.NONE;
        boolean hasPm25Issue = (pm25State != SiteState.SAFE);
        boolean hasPm10Issue = (pm10State != SiteState.SAFE);

        if (hasPm25Issue && hasPm10Issue) {
            breachType = PMBreachType.MULTIPLE;
        } else if (hasPm25Issue) {
            breachType = PMBreachType.PM2_5;
        } else if (hasPm10Issue) {
            breachType = PMBreachType.PM10;
        }

        return new Object[]{finalState, breachType};
    }
}