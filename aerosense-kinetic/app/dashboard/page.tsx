// src/app/dashboard/page.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { 
  Bell, 
  Download, 
  Activity, 
  AlertTriangle, 
  ShieldAlert, 
  Layers, 
  TrendingUp, 
  Server,
  X 
} from "lucide-react";

const DynamicMap = dynamic(() => import("../components/VietnamMap"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-3xl animate-pulse">
      <p className="text-gray-400 font-bold tracking-widest text-sm">INITIALIZING MAP RADAR...</p>
    </div>
  )
});

export default function DashboardHome() {
  const [showAlerts, setShowAlerts] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const mockAlerts = [
    { id: 1, type: "danger", site: "Da Nang Industrial", msg: "PM2.5 breached threshold (156 µg/m³)", time: "Just now" },
    { id: 2, type: "warning", site: "Hanoi Central", msg: "PM10 approaching critical limits", time: "14 mins ago" },
    { id: 3, type: "danger", site: "Ho Chi Minh Port Zone", msg: "Sensor hardware communication timeout", time: "1 hr ago" },
  ];

  const criticalSites = [
    { name: "Da Nang Industrial", p25: 156, p10: 98, trend: "up" },
    { name: "Ho Chi Minh Port Zone", p25: 112, p10: 145, trend: "up" },
    { name: "Hanoi Border Highway", p25: 94, p10: 88, trend: "stable" },
  ];

  const triggerDownload = () => {
    setIsDownloading(true);
    setTimeout(() => setIsDownloading(false), 2000);
  };

  return (
    <div className="p-8 min-h-screen bg-[#F8FAFC] flex flex-col gap-6 relative select-none">
      
      {/* --- TOP CONTROL HEADER --- */}
      <header className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-200/60 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-[#005A8C] tracking-tight">Command Center</h1>
          <p className="text-xs font-semibold text-gray-400 mt-0.5 uppercase tracking-wider">Air Quality Telemetry System</p>
        </div>

        <div className="flex items-center gap-3 relative">
          
          {/* FIXED: Added type, aria-label, and title for flawless compliance */}
          <button 
            type="button"
            onClick={() => setShowAlerts(!showAlerts)}
            aria-label="View alert notifications"
            title="Alert Notifications"
            className={`p-3 rounded-2xl border transition-all relative flex items-center justify-center cursor-pointer ${
              showAlerts 
                ? "bg-[#005A8C] border-[#005A8C] text-white shadow-md shadow-[#005A8C]/20" 
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            <Bell size={20} />
            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-[#F28C28] rounded-full ring-2 ring-white animate-bounce" />
          </button>

          {/* DROPDOWN PANEL FOR ALERTS */}
          {showAlerts && (
            <div className="absolute right-0 top-16 w-80 bg-white/95 backdrop-blur-xl border border-gray-200 shadow-[0_10px_30px_rgba(0,0,0,0.08)] rounded-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 mb-3">
                <span className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                  <ShieldAlert size={16} className="text-[#F28C28]" />
                  Active System Incidents
                </span>
                {/* FIXED: Added explicit button type, title, and descriptive aria-label */}
                <button 
                  type="button" 
                  onClick={() => setShowAlerts(false)} 
                  aria-label="Close alerts panel"
                  title="Close"
                  className="text-gray-400 hover:text-black cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {mockAlerts.map((alert) => (
                  <div key={alert.id} className={`p-3 rounded-xl text-xs border ${
                    alert.type === "danger" ? "bg-red-50/50 border-red-100 text-red-900" : "bg-amber-50/50 border-amber-100 text-amber-900"
                  }`}>
                    <div className="flex justify-between font-bold mb-0.5">
                      <span>{alert.site}</span>
                      <span className="text-[10px] font-medium opacity-60">{alert.time}</span>
                    </div>
                    <p className="opacity-90">{alert.msg}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DOWNLOAD REPORTS BUTTON */}
          {/* FIXED: Explicitly defined type attribute */}
          <button 
            type="button"
            onClick={triggerDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 px-5 py-3 bg-[#005A8C] text-white font-bold text-sm rounded-2xl hover:bg-[#00426b] hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
          >
            <Download size={16} />
            {isDownloading ? "Generating..." : "Download Report"}
          </button>
        </div>
      </header>

      {/* --- DASHBOARD WORKSPACE CANVAS --- */}
      <div className="flex-1 flex flex-col xl:flex-row gap-6 min-h-[calc(100vh-200px)]">
        
        {/* LEFT COLUMN: THE MAP OVERVIEW */}
        <div className="flex-1 relative rounded-[2rem] shadow-sm border border-gray-200/60 bg-white p-2 flex flex-col">
          <div className="absolute top-6 left-6 z-10 bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl border border-gray-100 text-xs font-bold text-[#005A8C] flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#009B9E] animate-ping" />
            Live Geospatial Matrix
          </div>
          <div className="w-full h-full min-h-[450px] xl:min-h-0 flex-1">
            <DynamicMap />
          </div>
        </div>
        
        {/* --- RIGHT COLUMN: ADVANCED SUMMARY SIDEBAR --- */}
        <aside className="w-full xl:w-96 bg-white rounded-[2rem] shadow-sm border border-gray-200/60 p-6 flex flex-col gap-6 overflow-y-auto">
          
          {/* SECTION 1: MACRO REPORT STATS */}
          <div>
            <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2 tracking-tight">
              <Layers size={18} className="text-[#005A8C]" />
              Macro Station Digest
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Sites</p>
                <p className="text-xl font-black text-[#005A8C] mt-0.5">24</p>
              </div>
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl text-center">
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Breaches</p>
                <p className="text-xl font-black text-red-600 mt-0.5">2</p>
              </div>
              <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-center">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Warnings</p>
                <p className="text-xl font-black text-[#F28C28] mt-0.5">1</p>
              </div>
            </div>
          </div>

          {/* SECTION 2: HOURLY AVERAGE LINE CHART (Custom SVG) */}
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-[#009B9E]" />
                <span className="font-bold text-sm text-gray-800">Hourly Averages (µg/m³)</span>
              </div>
              <span className="text-[10px] font-black bg-white px-2 py-0.5 rounded-md text-gray-400 border border-gray-100 shadow-2xs">24h FEED</span>
            </div>

            <div className="w-full h-24 relative mt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
                <line x1="0" y1="10" x2="100" y2="10" stroke="#E2E8F0" strokeWidth="0.2" strokeDasharray="1,1" />
                <line x1="0" y1="20" x2="100" y2="20" stroke="#E2E8F0" strokeWidth="0.2" strokeDasharray="1,1" />
                
                <path d="M 0 25 Q 20 18, 40 22 T 80 12 T 100 15 L 100 30 L 0 30 Z" fill="url(#tealGlow)" opacity="0.15" />
                <path d="M 0 25 Q 20 18, 40 22 T 80 12 T 100 15" fill="none" stroke="#009B9E" strokeWidth="1" strokeLinecap="round" />
                <path d="M 0 18 Q 25 10, 50 25 T 100 8" fill="none" stroke="#005A8C" strokeWidth="1.2" strokeLinecap="round" />
                
                <circle cx="100" cy="8" r="1.5" fill="#005A8C" />
                <circle cx="100" cy="8" r="3" fill="#005A8C" opacity="0.3" className="animate-ping" />

                <defs>
                  <linearGradient id="tealGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#009B9E" />
                    <stop offset="100%" stopColor="#009B9E" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div className="flex gap-4 mt-3 text-[11px] font-bold text-gray-500 justify-center">
              <span className="flex items-center gap-1.5"><span className="w-2 h-0.5 bg-[#005A8C] rounded-full" /> PM2.5 Avg</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-0.5 bg-[#009B9E] rounded-full" /> PM10 Avg</span>
            </div>
          </div>

          {/* SECTION 3: CRITICAL SITES */}
          <div className="flex-1 flex flex-col min-h-0">
            <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2 tracking-tight">
              <AlertTriangle size={18} className="text-[#F28C28]" />
              Critical Danger Nodes
            </h2>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {criticalSites.map((site, idx) => (
                <div key={idx} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-2xs flex flex-col gap-2 hover:border-gray-300 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-gray-800 truncate max-w-[180px]">{site.name}</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      site.p25 > 120 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {site.p25 > 120 ? "UNHEALTHY" : "MODERATE"}
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
              ))}
            </div>
          </div>

          {/* SECTION 4: INFRASTRUCTURE STATUS */}
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