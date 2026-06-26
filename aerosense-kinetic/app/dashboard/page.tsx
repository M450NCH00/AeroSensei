// src/app/dashboard/page.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Server } from "lucide-react";

import DashboardHeader from "../components/DashboardHeader";
import MacroDigest from "../components/MacroDigest";
import CriticalNodesList from "../components/CriticalNodesList";

const DynamicMap = dynamic(() => import("../components/AeroMap"), { 
  ssr: false,
  loading: () => (
    // Changed the loading state to blend with the glass theme
    <div className="w-full h-full flex items-center justify-center bg-white/40 backdrop-blur-md rounded-[1.5rem] animate-pulse">
      <p className="text-[#005A8C] font-black tracking-widest text-sm">INITIALIZING MAP RADAR...</p>
    </div>
  )
});

export default function DashboardHome() {
  const [isDownloading, setIsDownloading] = useState(false);

  const triggerDownload = () => {
    setIsDownloading(true);
    setTimeout(() => setIsDownloading(false), 2000);
  };

  return (
    // 1. Set the background to a cool slate to make the white glass pop
    <div className="p-8 min-h-screen bg-[#F1F5F9] flex flex-col gap-6 relative select-none overflow-hidden">
      
      {/* 2. THE AMBIENT AURA BACKGROUND */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Teal Orb */}
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-[#009B9E]/30 rounded-full mix-blend-multiply opacity-60 animate-blob-shift" />
        
        {/* Blue Orb (Delayed) */}
        <div className="absolute top-[20%] right-[-10%] w-[35rem] h-[35rem] bg-[#005A8C]/20 rounded-full mix-blend-multiply opacity-60 animate-blob-shift animation-delay-2000" />
        
        {/* Amber/Warning Orb (Delayed, Bottom center) */}
        <div className="absolute bottom-[-20%] left-[20%] w-[45rem] h-[45rem] bg-[#FBBF24]/20 rounded-full mix-blend-multiply opacity-50 animate-blob-shift animation-delay-4000" />
      </div>

      {/* 3. Main content wrapped in z-10 so it sits ABOVE the floating orbs */}
      <div className="relative z-10 flex flex-col gap-6 h-full">
        
        <DashboardHeader 
          onDownload={triggerDownload} 
          isDownloading={isDownloading} 
        />

        <div className="w-full flex flex-col xl:flex-row gap-6 h-[calc(100vh-4rem)] min-h-[600px]">
          
          {/* Map View Canvas Workspace - NOW WITH GLASSMORPHISM */}
          <div className="flex-1 relative rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 bg-white/70 backdrop-blur-2xl p-2 flex flex-col h-full overflow-hidden transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,90,140,0.08)] hover:bg-white/80">
            
            <div className="absolute top-6 left-6 z-10 bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/50 text-xs font-bold text-[#005A8C] flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#009B9E] animate-ping" />
              Live Geospatial Matrix
            </div>
            
            <div className="w-full h-full flex-1 rounded-[1.5rem] overflow-hidden border border-white/40">
              <DynamicMap />
            </div>
          </div>
          
          {/* Analytics Insights Sidebar - NOW WITH GLASSMORPHISM */}
          <aside className="w-full xl:w-96 shrink-0 bg-white/70 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 p-6 flex flex-col gap-6 h-full overflow-y-auto transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,90,140,0.08)] hover:bg-white/80">
            <MacroDigest />
            <CriticalNodesList />

            {/* Sync Status - Updated to match the high-end feel */}
            <div className="p-4 mt-auto bg-gradient-to-r from-[#005A8C]/5 to-[#009B9E]/5 border border-white/60 shadow-inner rounded-2xl flex items-center justify-between text-xs font-bold text-gray-500 shrink-0">
              <div className="flex items-center gap-2">
                <Server size={14} className="text-[#005A8C]" />
                <span>DB Sync Telemetry</span>
              </div>
              <span className="text-[#009B9E] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#009B9E] animate-pulse" /> 
                EXCELLENT (24ms)
              </span>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}