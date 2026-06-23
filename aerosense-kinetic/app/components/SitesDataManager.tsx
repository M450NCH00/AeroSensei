// src/components/SitesDataManager.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import axiosInstance from "@/app/api/axiosInstance";
import SitesTable, { SiteData, SortKey } from "./SitesTable";

interface SiteSensor15MinDTO {
  companyName: string;
  siteName: string;
  sensorId: string;
  latitude: number;
  longitude: number;
  status: string; 
  avgPm25: number;
  avgPm10: number;
  maxPm25: number;
  maxPm10: number;
  breachType: "NONE" | "PM2_5" | "PM10" | "MULTIPLE";
  state: "SAFE" | "WARNING" | "BREACHED";
  lastCalculated: string;
}

const getStatusScore = (site: SiteData) => {
  if (site.state === "BREACHED") return 5;
  if (site.state === "WARNING") return 4;
  if (site.status === "active") return 3;
  if (site.status === "maintenance") return 2;
  return 1; 
};

export default function SitesDataManager() {
  const [rawSites, setRawSites] = useState<SiteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // NEW: Sync tracking states
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>("Syncing...");

  // NEW: Wrapped in useCallback so it can be triggered manually
  const fetchAllSites = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get<SiteSensor15MinDTO[]>("/sensors/site/all-readings-15m");

      const formattedData: SiteData[] = response.data.map((sensor) => {
        const rawStatus = (sensor.status || "offline").toLowerCase();
        let uiStatus: SiteData["status"] = "offline";
        if (rawStatus.includes("active")) uiStatus = "active";
        if (rawStatus.includes("maintenance")) uiStatus = "maintenance";

        return {
          id: sensor.sensorId,
          name: sensor.siteName || `Node ${sensor.sensorId}`,
          company: sensor.companyName,
          avgPm25: sensor.avgPm25 != null ? sensor.avgPm25 : null,
          avgPm10: sensor.avgPm10 != null ? sensor.avgPm10 : null,
          maxPm25: sensor.maxPm25 != null ? sensor.maxPm25 : null,
          maxPm10: sensor.maxPm10 != null ? sensor.maxPm10 : null,
          breachType: sensor.breachType,
          state: sensor.state, 
          lastUpdated: sensor.lastCalculated ? new Date(sensor.lastCalculated).toLocaleTimeString([], { 
            hour: '2-digit', minute: '2-digit' 
          }) : "—",
          status: uiStatus,
        };
      });

      setRawSites(formattedData);
      setLastSync(new Date()); // Log the exact moment of successful fetch
    } catch (error) {
      console.error("Failed to fetch sites telemetry:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 1. Initial Load Only (No auto-refresh interval)
  useEffect(() => {
    fetchAllSites();
  }, [fetchAllSites]);

  // 2. Local Timer updater (Updates the "Just now" text every 10 seconds)
  useEffect(() => {
    if (!lastSync) return;
    
    const updateText = () => {
      const diffInSeconds = Math.floor((new Date().getTime() - lastSync.getTime()) / 1000);
      const diffInMinutes = Math.floor(diffInSeconds / 60);

      if (diffInSeconds < 15) {
        setTimeAgo("Just now");
      } else if (diffInSeconds < 60) {
        setTimeAgo(`${diffInSeconds}s ago`);
      } else {
        setTimeAgo(`${diffInMinutes}m ago`);
      }
    };
    
    updateText(); 
    const textInterval = setInterval(updateText, 10000);
    return () => clearInterval(textInterval);
  }, [lastSync]);

  const processedData = useMemo(() => {
    let filtered = rawSites.filter(
      (site) =>
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (site.company && site.company.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortKey === "status") {
        comparison = getStatusScore(a) - getStatusScore(b);
      } else if (sortKey === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortKey === "avgPm25") {
        const valA = a.avgPm25 ?? -1;
        const valB = b.avgPm25 ?? -1;
        comparison = valA - valB;
      } else if (sortKey === "avgPm10") {
        const valA = a.avgPm10 ?? -1;
        const valB = b.avgPm10 ?? -1;
        comparison = valA - valB;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [rawSites, searchTerm, sortKey, sortDirection]);

  const handleSortToggle = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection(key === "name" ? "asc" : "desc");
    }
  };

  return (
    <SitesTable
      data={processedData}
      isLoading={isLoading}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortToggle={handleSortToggle}
      // Pass the new props down to the table
      onRefresh={fetchAllSites}
      timeAgo={timeAgo}
    />
  );
}