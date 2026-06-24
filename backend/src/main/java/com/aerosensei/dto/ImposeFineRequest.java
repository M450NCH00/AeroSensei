package com.aerosensei.dto;

import java.math.BigDecimal;

/** Government payload to impose a fine against a PM-breach alert. */
public class ImposeFineRequest {
    private BigDecimal amount;
    private String reason;

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
