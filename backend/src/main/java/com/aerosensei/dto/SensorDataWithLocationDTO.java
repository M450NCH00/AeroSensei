package com.aerosensei.dto;

public class SensorDataWithLocationDTO {
    // Reusing your exact existing DTOs!
    private SensorInfoDTO info;
    private SensorAverageDTO liveData;

    public SensorDataWithLocationDTO(SensorInfoDTO info, SensorAverageDTO liveData) {
        this.info = info;
        this.liveData = liveData;
    }

    public SensorInfoDTO getInfo() { return info; }
    public void setInfo(SensorInfoDTO info) { this.info = info; }

    public SensorAverageDTO getLiveData() { return liveData; }
    public void setLiveData(SensorAverageDTO liveData) { this.liveData = liveData; }
}
