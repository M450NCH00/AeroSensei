package com.aerosensei.dto;

public class EvaluateResponse {
    private double result;

    public EvaluateResponse() {}
    public EvaluateResponse(double result) { this.result = result; }

    public double getResult() { return result; }
    public void setResult(double result) { this.result = result; }
}
