// src/app/dashboard/page.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Server } from "lucide-react";

// Components
import DashboardHeader from "../components/DashboardHeader";
import MacroDigest from "../components/MacroDigest";
import HourlyAveragesChart from "../components/HourlyAveragesChart";
import CriticalNodesList from "../components/CriticalNodesList";

const DynamicMap = dynamic(() => import("../components/VietnamMap"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-3xl animate-pulse">
      <p className="text-gray-400 font-bold tracking-widest text-sm">INITIALIZING MAP RADAR...</p>
    </div>
  )
});

export default function DashboardHome() {
  const [isDownloading, setIsDownloading] = useState(false);

  const mockAlerts = [
    { id: 1, type: "danger", site: "Da Nang Industrial", msg: "PM2.5 breached threshold (156 µg/m³)", time: "Just now" },
    { id: 2, type: "warning", site: "Hanoi Central", msg: "PM10 approaching critical limits", time: "14 mins ago" },
    { id: 3, type: "danger", site: "Ho Chi Minh Port Zone", msg: "Sensor hardware communication timeout", time: "1 hr ago" },
  ];

  const triggerDownload = () => {
    setIsDownloading(true);
    setTimeout(() => setIsDownloading(false), 2000);
  };

  return (
    <div className="p-8 min-h-screen bg-[#F8FAFC] flex flex-col gap-6 relative select-none">
      
      {/* Reusable Header */}
      <DashboardHeader 
        onDownload={triggerDownload} 
        isDownloading={isDownloading} 
        alerts={mockAlerts} 
      />

      <div className="flex-1 flex flex-col xl:flex-row gap-6 min-h-[calc(100vh-200px)]">
        
        {/* Map View Canvas */}
        <div className="flex-1 relative rounded-[2rem] shadow-sm border border-gray-200/60 bg-white p-2 flex flex-col">
          <div className="absolute top-6 left-6 z-10 bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl border border-gray-100 text-xs font-bold text-[#005A8C] flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#009B9E] animate-ping" />
            Live Geospatial Matrix
          </div>
          <div className="w-full h-full min-h-[450px] xl:min-h-0 flex-1">
            <DynamicMap />
          </div>
        </div>
        
        {/* Advanced Summary Sidebar */}
        <aside className="w-full xl:w-96 bg-white rounded-[2rem] shadow-sm border border-gray-200/60 p-6 flex flex-col gap-6 overflow-y-auto">
          <MacroDigest />
          <HourlyAveragesChart />
          <CriticalNodesList />

          <div className="p-4 bg-[#005A8C]/5 border border-[#005A8C]/10 rounded-2xl flex items-center justify-between text-xs font-bold text-gray-500">
            <div className="flex items-center gap-2">
              <Server size={14} className="text-[#005A8C]" />
              <span>DB Sync Telemetry</span>
            </div>
            <span className="text-[#009B9E]">● EXCELLENT (24ms)</span>
          </div>
        </aside>
      </div>
    </div>
  );
}