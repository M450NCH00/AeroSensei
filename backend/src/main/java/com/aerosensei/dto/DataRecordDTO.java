package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.Instant;

public class DataRecordDTO {
    public record SensorPayLoad(
            String sensorId,
            BigDecimal pm2_5,
            BigDecimal pm10,
            BigDecimal pm4_0,
            BigDecimal pm1_0,
            BigDecimal nc0_5,
            Instant timestamp
    ){}

    public record SensorReading(
            BigDecimal pm2_5,
            BigDecimal pm10,
            Instant timestamp
    ){}
}
