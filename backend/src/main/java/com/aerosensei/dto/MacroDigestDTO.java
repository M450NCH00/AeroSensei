package com.aerosensei.dto;

public class MacroDigestDTO {
    private int totalSites;
    private int activeWarnings;
    private int activeBreaches;

    public MacroDigestDTO(int totalSites, int activeWarnings, int activeBreaches) {
        this.totalSites = totalSites;
        this.activeWarnings = activeWarnings;
        this.activeBreaches = activeBreaches;
    }

    public int getTotalSites() { return totalSites; }
    public void setTotalSites(int totalSites) { this.totalSites = totalSites; }

    public int getActiveWarnings() { return activeWarnings; }
    public void setActiveWarnings(int activeWarnings) { this.activeWarnings = activeWarnings; }

    public int getActiveBreaches() { return activeBreaches; }
    public void setActiveBreaches(int activeBreaches) { this.activeBreaches = activeBreaches; }
}