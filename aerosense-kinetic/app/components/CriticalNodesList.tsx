// src/components/CriticalNodesList.tsx
"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import axiosInstance from "@/app/api/axiosInstance";

// 1. Define the incoming Backend DTO structure
interface SensorAverageDTO {
  sensorId: string;
  locationName: string;
  pm25: number;
  pm10: number;
  lastCalculated: string;
}

// 2. Define the shape for the component's internal state
interface CriticalSite {
  id: string;
  name: string;
  p25: number;
  p10: number;
}

export default function CriticalNodesList() {
  const [criticalSites, setCriticalSites] = useState<CriticalSite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCriticalNodes = async () => {
      try {
        const response = await axiosInstance.get<SensorAverageDTO[]>("/sensors/area/average", {
          params: {
            minLat: 8.0,
            maxLat: 24.0,
            minLon: 102.0,
            maxLon: 110.0,
          },
        });

        // Filter offline sensors, sort descending by PM2.5, and slice the top 3
        const topNodes = response.data
          .filter((sensor) => sensor.pm25 != null)
          .sort((a, b) => b.pm25 - a.pm25)
          .slice(0, 3)
          .map((sensor) => ({
            id: sensor.sensorId, // Use real DB ID for React keys
            name: sensor.locationName || `Node ${sensor.sensorId}`,
            p25: sensor.pm25,
            p10: sensor.pm10 != null ? sensor.pm10 : 0, // Fallback if PM10 is missing
          }));

        setCriticalSites(topNodes);
      } catch (error) {
        console.error("Failed to fetch critical nodes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCriticalNodes();
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2 tracking-tight">
        <AlertTriangle size={18} className="text-[#F28C28]" />
        Critical Danger Nodes
      </h2>
      
      <div className="space-y-3 overflow-y-auto flex-1 pr-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-24 text-gray-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : criticalSites.length === 0 ? (
          <div className="text-center text-sm font-bold text-gray-400 py-6 border border-dashed border-gray-200 rounded-2xl">
            All nodes operating safely.
          </div>
        ) : (
          criticalSites.map((site) => (
            // Swapped the array index for the actual unique database ID
            <div key={site.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-2xs flex flex-col gap-2 hover:border-gray-300 transition-colors">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-gray-800 truncate max-w-[180px]">{site.name}</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  site.p25 > 35 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {/* Adjusted threshold closer to standard WHO safety limits */}
                  {site.p25 > 35 ? "UNHEALTHY" : "MODERATE"}
                </span>
              </div>
              
              <div className="grid grid-cols-2 text-xs font-bold border-t border-gray-50 pt-2 mt-0.5">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400">PM2.5</p>
                  <p className="text-sm font-black text-gray-700 mt-0.5">{site.p25} <span className="text-[10px] font-normal text-gray-400">µg</span></p>
                </div>
                <div className="border-l border-gray-100 pl-3">
                  <p className="text-[10px] font-semibold text-gray-400">PM10</p>
                  <p className="text-sm font-black text-gray-700 mt-0.5">{site.p10} <span className="text-[10px] font-normal text-gray-400">µg</span></p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}