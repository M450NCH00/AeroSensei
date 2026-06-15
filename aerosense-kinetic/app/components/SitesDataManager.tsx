// src/components/SitesDataManager.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import axiosInstance from "@/app/api/axiosInstance";
import SitesTable, { SiteData, SortKey } from "./SitesTable";

interface SensorAverageDTO {
  sensorId: string;
  locationName: string;
  pm25: number;
  pm10: number;
  lastCalculated: string;
}

export default function SitesDataManager() {
  const [rawSites, setRawSites] = useState<SiteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Interactive States
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc"); // Default alphabetical

  useEffect(() => {
    const fetchAllSites = async () => {
      try {
        const response = await axiosInstance.get<SensorAverageDTO[]>("/sensors/area/average", {
          params: { minLat: 8.0, maxLat: 24.0, minLon: 102.0, maxLon: 110.0 },
        });

        // Map backend DTO to our UI table format
        const formattedData: SiteData[] = response.data.map((sensor) => {
          let status: SiteData["status"] = "offline";
          if (sensor.pm25 != null) {
            if (sensor.pm25 > 35) status = "danger";
            else if (sensor.pm25 > 15) status = "warning";
            else status = "good";
          }

          return {
            id: sensor.sensorId,
            name: sensor.locationName || `Node ${sensor.sensorId}`,
            pm25: sensor.pm25,
            pm10: sensor.pm10,
            lastUpdated: new Date(sensor.lastCalculated).toLocaleTimeString([], { 
              hour: '2-digit', minute: '2-digit' 
            }),
            status,
          };
        });

        setRawSites(formattedData);
      } catch (error) {
        console.error("Failed to fetch sites telemetry:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllSites();
  }, []);

  // useMemo ensures we only recalculate sorting/filtering when the user types or clicks
  const processedData = useMemo(() => {
    // 1. Filter by Search Term
    let filtered = rawSites.filter(
      (site) =>
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 2. Sort the filtered results
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortKey === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortKey === "pm25") {
        // Handle null values gracefully by pushing them to the bottom
        const valA = a.pm25 ?? -1;
        const valB = b.pm25 ?? -1;
        comparison = valA - valB;
      } else if (sortKey === "pm10") {
        const valA = a.pm10 ?? -1;
        const valB = b.pm10 ?? -1;
        comparison = valA - valB;
      }

      // Flip the math if descending
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [rawSites, searchTerm, sortKey, sortDirection]);

  // Handler for clicking table headers
  const handleSortToggle = (key: SortKey) => {
    if (sortKey === key) {
      // If clicking the same column, just flip the direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // If clicking a new column, sort by that column and default to ascending
      setSortKey(key);
      setSortDirection("asc");
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
    />
  );
}