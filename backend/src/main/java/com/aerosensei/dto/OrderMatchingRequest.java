package com.aerosensei.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class OrderMatchingRequest {

    private String requestId;
    private Long companyId;
    private String email;
    private BigDecimal creditsAmount;
    private BigDecimal pricePerCredit;
    private Long listingId;
    private String orderType; // "BUY" or "SELL"
    private LocalDateTime timestamp;

    public OrderMatchingRequest() {}

    public OrderMatchingRequest(String requestId, Long companyId, String email,
                                BigDecimal creditsAmount, BigDecimal pricePerCredit,
                                Long listingId, String orderType) {
        this.requestId = requestId;
        this.companyId = companyId;
        this.email = email;
        this.creditsAmount = creditsAmount;
        this.pricePerCredit = pricePerCredit;
        this.listingId = listingId;
        this.orderType = orderType;
        this.timestamp = LocalDateTime.now();
    }

    public String getRequestId()           { return requestId; }
    public void setRequestId(String v)     { this.requestId = v; }

    public Long getCompanyId()             { return companyId; }
    public void setCompanyId(Long v)       { this.companyId = v; }

    public String getEmail()               { return email; }
    public void setEmail(String v)         { this.email = v; }

    public BigDecimal getCreditsAmount()           { return creditsAmount; }
    public void setCreditsAmount(BigDecimal v)     { this.creditsAmount = v; }

    public BigDecimal getPricePerCredit()          { return pricePerCredit; }
    public void setPricePerCredit(BigDecimal v)    { this.pricePerCredit = v; }

    public Long getListingId()             { return listingId; }
    public void setListingId(Long v)       { this.listingId = v; }

    public String getOrderType()           { return orderType; }
    public void setOrderType(String v)     { this.orderType = v; }

    public LocalDateTime getTimestamp()    { return timestamp; }
    public void setTimestamp(LocalDateTime v) { this.timestamp = v; }
}
