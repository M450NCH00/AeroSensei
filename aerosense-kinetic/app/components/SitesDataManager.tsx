// src/components/SitesDataManager.tsx
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import axiosInstance from "@/app/api/axiosInstance";
import SitesTable, { SiteData, SortKey } from "./SitesTable";
import SiteDetailsModal from "./SiteDetailsModal";

export interface SiteSensor15MinDTO {
  companyName: string;
  siteName: string;
  siteId: number;
  latitude: number;
  longitude: number;
  avgPm25: number;
  avgPm10: number;
  maxPm25: number;
  maxPm10: number;
  breachType: "NONE" | "PM2_5" | "PM10" | "MULTIPLE";
  state: "SAFE" | "WARNING" | "BREACHED";
  lastCalculated: string;
}

// Updated to score strictly based on the new "state"
const getStateScore = (site: SiteData) => {
  if (site.state === "BREACHED") return 3;
  if (site.state === "WARNING") return 2;
  if (site.state === "SAFE") return 1;
  return 0; 
};

export default function SitesDataManager() {
  const [rawSites, setRawSites] = useState<SiteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState("");
  // Assuming "state" replaces the old "status" sort key in your SitesTable component
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>("Syncing...");

  const [selectedSite, setSelectedSite] = useState<SiteData | null>(null);

  const searchParams = useSearchParams();
  const hasAutoOpened = useRef(false);

  const fetchAllSites = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get<SiteSensor15MinDTO[]>("/sensors/site/all-readings-15m");

      const formattedData: SiteData[] = response.data.map((sensor) => {
        return {
          // Fallback to a composite string for unique ID since sensorId is gone
          id: `${sensor.companyName}-${sensor.siteName}`,
          siteId: sensor.siteId,
          name: sensor.siteName || "Unknown Site",
          company: sensor.companyName,
          latitude: sensor.latitude,
          longitude: sensor.longitude,
          avgPm25: sensor.avgPm25 != null ? sensor.avgPm25 : null,
          avgPm10: sensor.avgPm10 != null ? sensor.avgPm10 : null,
          maxPm25: sensor.maxPm25 != null ? sensor.maxPm25 : null,
          maxPm10: sensor.maxPm10 != null ? sensor.maxPm10 : null,
          breachType: sensor.breachType,
          state: sensor.state, 
          lastUpdated: sensor.lastCalculated ? new Date(sensor.lastCalculated).toLocaleTimeString([], { 
            hour: '2-digit', minute: '2-digit' 
          }) : "—",
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

  // 2. Local Timer updater
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

  useEffect(() => {
    const latParam = searchParams.get("lat");
    const lonParam = searchParams.get("lon");

    // Only run if we have coordinates in the URL, data has loaded, and we haven't opened it yet
    if (latParam && lonParam && rawSites.length > 0 && !hasAutoOpened.current) {
      const targetLat = parseFloat(latParam);
      const targetLon = parseFloat(lonParam);

      // Using Math.abs to safely compare floating point numbers (coordinates)
      const targetSite = rawSites.find(
        (s) => 
          Math.abs(s.latitude - targetLat) < 0.0001 && 
          Math.abs(s.longitude - targetLon) < 0.0001
      );

      if (targetSite) {
        setSelectedSite(targetSite);
        hasAutoOpened.current = true; // Lock it so it doesn't re-open when closed
      }
    }
  }, [searchParams, rawSites]);

  const processedData = useMemo(() => {
    let filtered = rawSites.filter(
      (site) =>
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (site.company && site.company.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    filtered.sort((a, b) => {
      let comparison = 0;
      
      // Update logic: Use the new state scoring instead of old status
      if (sortKey === "state" || sortKey === ("status" as any)) {
        comparison = getStateScore(a) - getStateScore(b);
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
    <>
      <SitesTable
        data={processedData}
        isLoading={isLoading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortToggle={handleSortToggle}
        onRefresh={fetchAllSites}
        timeAgo={timeAgo}
        onViewDetails={setSelectedSite}
      />

      {selectedSite && (
        <SiteDetailsModal 
          site={selectedSite} 
          onClose={() => setSelectedSite(null)} 
        />
      )}
    </>
  );
}