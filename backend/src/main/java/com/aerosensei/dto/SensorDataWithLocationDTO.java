package com.aerosensei.dto;

public class SensorDataWithLocationDTO {
    // Reusing your exact existing DTOs!
    private SensorInfoDTO info;
    private SensorReadingsDTO liveData;

    public SensorDataWithLocationDTO(SensorInfoDTO info, SensorReadingsDTO liveData) {
        this.info = info;
        this.liveData = liveData;
    }

    public SensorInfoDTO getInfo() { return info; }
    public void setInfo(SensorInfoDTO info) { this.info = info; }

    public SensorReadingsDTO getLiveData() { return liveData; }
    public void setLiveData(SensorReadingsDTO liveData) { this.liveData = liveData; }
}
