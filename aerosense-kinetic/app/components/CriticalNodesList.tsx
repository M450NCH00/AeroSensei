// src/components/CriticalNodesList.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import axiosInstance from "../api/axiosInstance";
import { SiteSensor15MinDTO } from "./SitesDataManager";

const getStateColor = (state: "SAFE" | "WARNING" | "BREACHED") => {
  switch (state) {
    case "BREACHED": return "bg-red-100 text-red-700 border-red-200";
    case "WARNING": return "bg-amber-100 text-amber-700 border-amber-200";
    case "SAFE": return "bg-[#009B9E]/15 text-[#007B7E] border-[#009B9E]/30"; 
    default: return "bg-gray-100 text-gray-700";
  }
};

const formatBreachType = (type: string) => {
  if (type === "PM2_5") return "PM2.5";
  if (type === "MULTIPLE") return "PM2.5 & PM10";
  return type;
};

export default function CriticalNodesList() {
  // 2. Update state to use new DTO
  const [criticalSites, setCriticalSites] = useState<SiteSensor15MinDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Sync tracking states
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>("Syncing...");

  // Wrapped in useCallback for safe interval usage
  const fetchCriticalNodes = useCallback(async () => {
    setIsLoading(true);
    try {
      // 3. Update the generic type for the axios call
      const response = await axiosInstance.get<SiteSensor15MinDTO[]>("/sensors/area/5/critical");
      setCriticalSites(response.data);
      setLastSync(new Date());
    } catch (error) {
      console.error("Failed to fetch critical nodes:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 1. Initial load & Auto-refresh interval (60 seconds)
  useEffect(() => {
    fetchCriticalNodes();
    const fetchInterval = setInterval(fetchCriticalNodes, 300000);
    return () => clearInterval(fetchInterval);
  }, [fetchCriticalNodes]);

  // 2. Local Timer string updater (10 seconds)
  useEffect(() => {
    if (!lastSync) return;
    
    const updateText = () => {
      const diffInMinutes = Math.floor((new Date().getTime() - lastSync.getTime()) / 60000);
      if (diffInMinutes === 0) setTimeAgo("Just now");
      else setTimeAgo(`${diffInMinutes}m ago`);
    };
    
    updateText(); 
    const textInterval = setInterval(updateText, 10000);
    return () => clearInterval(textInterval);
  }, [lastSync]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      
      {/* HEADER: Added justify-between and the Sync Button */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-black text-base text-gray-800 flex items-center gap-2 tracking-tight">
          <AlertTriangle size={18} className="text-[#F28C28]" />
          Critical Danger Nodes
        </h2>
        
        <button 
          onClick={fetchCriticalNodes}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-[#F28C28] transition-colors disabled:opacity-50"
          title="Force refresh critical list"
        >
          {timeAgo}
          <RefreshCw size={12} className={isLoading ? "animate-spin text-[#F28C28]" : ""} />
        </button>
      </div>
      
      <div className="space-y-3 overflow-y-auto flex-1 pr-1">
        
        {/* Only show the full loader if we have NO data yet (first load) */}
        {isLoading && criticalSites.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-gray-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : criticalSites.length === 0 ? (
          <div className="text-center text-sm font-bold text-gray-400 py-6 border border-dashed border-gray-200 rounded-2xl">
            No critical sites available. All nodes operating safely.
          </div>
        ) : (
          criticalSites.map((site, index) => (
            // 4. Using a composite key since sensorId is gone (adding index fallback just in case of duplicates)
            <div key={`${site.companyName}-${site.siteName}-${index}`} className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col gap-2 hover:border-gray-300 transition-colors">
              
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  {/* 5. Using siteName and companyName instead of locationName */}
                  <span className="font-bold text-sm text-gray-800 truncate max-w-[170px]">
                    {site.siteName || "Unknown Node"}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5 truncate max-w-[170px]">
                    {site.companyName || "Unknown Company"}
                  </span>
                </div>
                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border ${getStateColor(site.state)} tracking-wider`}>
                  {site.state}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">PM2.5</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] text-gray-500 font-semibold">15m Avg</p>
                      <p className="text-sm font-black text-gray-800 leading-none">{site.avgPm25}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 font-semibold">Peak</p>
                      <p className="text-sm font-black text-gray-800 leading-none">{site.maxPm25}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">PM10</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] text-gray-500 font-semibold">15m Avg</p>
                      <p className="text-sm font-black text-gray-800 leading-none">{site.avgPm10}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 font-semibold">Peak</p>
                      <p className="text-sm font-black text-gray-800 leading-none">{site.maxPm10}</p>
                    </div>
                  </div>
                </div>
              </div>

              {site.breachType !== "NONE" && (
                <div className="text-[10px] font-bold text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                  Flagged by: {formatBreachType(site.breachType)}
                </div>
              )}

            </div>
          ))
        )}
      </div>
    </div>
  );
}