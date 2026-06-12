package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class OhlcCandle {
    private BigDecimal open;
    private BigDecimal high;
    private BigDecimal low;
    private BigDecimal close;
    private BigDecimal volume;
    private LocalDateTime timestamp;

    public OhlcCandle(BigDecimal open, BigDecimal high, BigDecimal low,
                      BigDecimal close, BigDecimal volume, LocalDateTime timestamp) {
        this.open = open;
        this.high = high;
        this.low = low;
        this.close = close;
        this.volume = volume;
        this.timestamp = timestamp;
    }

    public BigDecimal getOpen()          { return open; }
    public BigDecimal getHigh()          { return high; }
    public BigDecimal getLow()           { return low; }
    public BigDecimal getClose()         { return close; }
    public BigDecimal getVolume()        { return volume; }
    public LocalDateTime getTimestamp()  { return timestamp; }
}
