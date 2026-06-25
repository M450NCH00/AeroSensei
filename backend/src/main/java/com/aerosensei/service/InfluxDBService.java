package com.aerosensei.service;

import com.influxdb.client.InfluxDBClient;
import com.influxdb.client.InfluxDBClientFactory;
import com.influxdb.client.WriteApi;
import com.influxdb.client.write.Point;
import com.influxdb.client.domain.WritePrecision;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;

import com.aerosensei.dto.DataRecordDTO;
import org.springframework.stereotype.Service;

@Service
public class InfluxDBService {

    //influxdb properties
    @Value("${influxdb.org}")
    private String org;

    @Value("${influxdb.bucket}")
    private String bucket;

    @Autowired
    private SensorIdTranslationService translationService;

    private final InfluxDBClient influxDBClient;

    private final WriteApi writeApi;

    private static final Logger logs = LoggerFactory.getLogger(InfluxDBService.class);

    public InfluxDBService(
            @Value("${influxdb.url}") String url,
            @Value("${influxdb.token}") String token
    ){
        this.influxDBClient = InfluxDBClientFactory.create(url, token.toCharArray());
        // makeWriteApi() creates an asynchronous, background-batching client automatically
        this.writeApi = influxDBClient.makeWriteApi();
    }

    @Async
    public void saveRawDataAsync(DataRecordDTO.SensorPayLoad payload) throws Exception {
        try {
            // 1. Get the UUID using the Translation Service!
            // This method handles the Optional internally and caches the result for high performance.
            String realSensorUuid = translationService.getUuidFromLabel(payload.sensorId());

            Instant time = payload.timestamp() != null ? payload.timestamp() : Instant.now();

            // 2. Build the Point using the extracted String
            Point point = Point.measurement("air_quality")
                    .addTag("sensor_id", realSensorUuid)
                    .addField("pm1_0", payload.pm1_0())
                    .addField("pm2_5", payload.pm2_5())
                    .addField("pm4_0", payload.pm4_0())
                    .addField("pm10", payload.pm10())
                    .addField("nc0_5", payload.nc0_5())
                    .time(time, WritePrecision.NS);

            writeApi.writePoint(bucket, org, point);

            logs.info("Sensor {} (UUID: {}) record - pm2.5: {}, pm10: {} recorded successfully.",
                    payload.sensorId(), realSensorUuid, payload.pm2_5(), payload.pm10());

        } catch (IllegalArgumentException e) {
            logs.error("Rejected payload: {}", e.getMessage());
            throw new Exception("Unregistered sensor attempted to write to InfluxDB");
        } catch (Exception e) {
            logs.error("Error on influx db: {}", e.toString());
            throw new Exception("Error on influx db service");
        }
    }

    @PreDestroy
    public void close() {
        logs.info("Shutting down InfluxDB connection and flushing pending writes...");
        if (writeApi != null) {
            writeApi.close();
        }
        if (influxDBClient != null) {
            influxDBClient.close();
        }
    }

}
