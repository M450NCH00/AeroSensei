// src/components/DashboardHeader.tsx
"use client";

import { useState } from "react";
import { Bell, Download, ShieldAlert, X } from "lucide-react";

interface Alert {
  id: number;
  type: string;
  site: string;
  msg: string;
  time: string;
}

interface DashboardHeaderProps {
  onDownload: () => void;
  isDownloading: boolean;
  alerts: Alert[];
}

export default function DashboardHeader({ onDownload, isDownloading, alerts }: DashboardHeaderProps) {
  const [showAlerts, setShowAlerts] = useState(false);

  return (
    <header className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-200/60 shadow-sm">
      <div>
        <h1 className="text-2xl font-black text-[#005A8C] tracking-tight">Command Center</h1>
        <p className="text-xs font-semibold text-gray-400 mt-0.5 uppercase tracking-wider">Air Quality Telemetry System</p>
      </div>

      <div className="flex items-center gap-3 relative">
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

        {showAlerts && (
          <div className="absolute right-0 top-16 w-80 bg-white/95 backdrop-blur-xl border border-gray-200 shadow-[0_10px_30px_rgba(0,0,0,0.08)] rounded-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 mb-3">
              <span className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-[#F28C28]" />
                Active System Incidents
              </span>
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
              {alerts.map((alert) => (
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

        <button 
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          className="flex items-center gap-2 px-5 py-3 bg-[#005A8C] text-white font-bold text-sm rounded-2xl hover:bg-[#00426b] hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
        >
          <Download size={16} />
          {isDownloading ? "Generating..." : "Download Report"}
        </button>
      </div>
    </header>
  );
}