package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class MatchingCompleteEvent {

    private String requestId;
    private Long listingId;
    private String matchStatus; // "FULLY_MATCHED", "PARTIALLY_MATCHED", "UNMATCHED"
    private BigDecimal matchedAmount;
    private BigDecimal remainingAmount;
    private List<Long> transactionIds;
    private LocalDateTime timestamp;

    public MatchingCompleteEvent() {}

    public MatchingCompleteEvent(String requestId, Long listingId, String matchStatus,
                                 BigDecimal matchedAmount, BigDecimal remainingAmount,
                                 List<Long> transactionIds) {
        this.requestId = requestId;
        this.listingId = listingId;
        this.matchStatus = matchStatus;
        this.matchedAmount = matchedAmount;
        this.remainingAmount = remainingAmount;
        this.transactionIds = transactionIds;
        this.timestamp = LocalDateTime.now();
    }

    public String getRequestId()                { return requestId; }
    public void setRequestId(String v)          { this.requestId = v; }

    public Long getListingId()                  { return listingId; }
    public void setListingId(Long v)            { this.listingId = v; }

    public String getMatchStatus()              { return matchStatus; }
    public void setMatchStatus(String v)        { this.matchStatus = v; }

    public BigDecimal getMatchedAmount()        { return matchedAmount; }
    public void setMatchedAmount(BigDecimal v)  { this.matchedAmount = v; }

    public BigDecimal getRemainingAmount()      { return remainingAmount; }
    public void setRemainingAmount(BigDecimal v){ this.remainingAmount = v; }

    public List<Long> getTransactionIds()       { return transactionIds; }
    public void setTransactionIds(List<Long> v) { this.transactionIds = v; }

    public LocalDateTime getTimestamp()         { return timestamp; }
    public void setTimestamp(LocalDateTime v)   { this.timestamp = v; }
}
