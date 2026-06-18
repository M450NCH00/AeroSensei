package com.aerosensei.dto;

import java.util.Map;

public class EvaluateRequest {
    private Map<String, Object> parameters;

    public Map<String, Object> getParameters() { return parameters; }
    public void setParameters(Map<String, Object> parameters) { this.parameters = parameters; }
}
