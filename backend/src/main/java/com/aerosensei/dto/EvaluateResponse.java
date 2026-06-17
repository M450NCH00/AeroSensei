package com.aerosensei.dto;

public class EvaluateResponse {
    private Double emissionResult;   // tCO2e from the emissions formula
    private Double activityResult;   // output from the activity-level formula (null if none)

    public EvaluateResponse() {}

    public EvaluateResponse(Double emissionResult, Double activityResult) {
        this.emissionResult = emissionResult;
        this.activityResult = activityResult;
    }

    public Double getEmissionResult() { return emissionResult; }
    public void setEmissionResult(Double emissionResult) { this.emissionResult = emissionResult; }

    public Double getActivityResult() { return activityResult; }
    public void setActivityResult(Double activityResult) { this.activityResult = activityResult; }
}
