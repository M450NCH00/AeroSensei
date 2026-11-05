// src/components/DashboardHeader.tsx
"use client";

// 1. Added useRef to our imports
import { useState, useEffect, useRef } from "react";
import { Bell, ShieldAlert, X, CheckCircle2 } from "lucide-react";
import axiosInstance from "@/app/api/axiosInstance";
import { useAuth } from "@/app/context/AuthContext";

export interface PmAlertResponse {
  id: number;
  siteId: number;
  siteName: string;
  companyId: number;
  companyName: string;
  pmType: string;
  measuredValue: number;
  thresholdValue: number;
  alertLevel: string;
  triggeredAt: string;
  resolvedAt: string | null;
  note: string | null;
  fined: boolean;
}

export default function DashboardHeader() {
  const [showAlerts, setShowAlerts] = useState(false);
  const { hasRole } = useAuth();
  
  const [alerts, setAlerts] = useState<PmAlertResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 2. Create a reference to attach to our dropdown wrapper
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 3. The Click-Outside Listener Logic
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If the click is OUTSIDE the dropdownRef container, close the alerts
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAlerts(false);
      }
    };

    // Only attach the listener if the menu is actually open
    if (showAlerts) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    // Cleanup listener when component unmounts or state changes
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAlerts]);

  useEffect(() => {
    const fetchAlerts = async () => {
      setIsLoading(true);
      try {
        const isGov = hasRole("Government") || hasRole("ADMIN");
        const endpoint = isGov ? "/alerts" : "/alerts/my";
        
        const res = await axiosInstance.get(endpoint);
        const data = Array.isArray(res) ? res : (res.data?.data || res.data || []);
        setAlerts(data);
      } catch (error) {
        console.error("Failed to fetch alerts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();
  }, [hasRole]);

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleString([], { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  const hasActiveAlerts = alerts.some(a => a.resolvedAt === null);

  return (
    <header className="relative z-50 flex justify-between items-center bg-white/70 backdrop-blur-2xl border border-white/60 p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,90,140,0.05)]">
      <div>
        <h1 className="text-2xl font-black text-[#005A8C] tracking-tight flex items-center gap-2">
          Command Center
        </h1>
        <p className="text-[10px] font-black text-gray-400 mt-0.5 uppercase tracking-widest bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-md w-max">
          Air Quality Telemetry System
        </p>
      </div>

      <div className="flex items-center gap-3 relative">
        
        {/* 4. We attach the dropdownRef to this wrapper div that holds BOTH the button and the popup */}
        <div className="relative" ref={dropdownRef}>
          <button 
            type="button"
            onClick={() => setShowAlerts(!showAlerts)}
            aria-label="View alert notifications"
            title="Alert Notifications"
            className={`p-3 rounded-2xl border transition-all duration-300 relative flex items-center justify-center cursor-pointer active:scale-95 ${
              showAlerts 
                ? "bg-[#005A8C] border-[#005A8C] text-white shadow-lg shadow-[#005A8C]/30" 
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50 hover:shadow-md"
            }`}
          >
            <Bell size={20} className={`transition-transform duration-300 ${showAlerts ? "rotate-12 scale-110" : "group-hover:animate-bounce"}`} />
            
            {hasActiveAlerts && !showAlerts && (
              <>
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-[#F28C28] rounded-full ring-2 ring-white animate-ping opacity-75" />
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-[#F28C28] rounded-full ring-2 ring-white" />
              </>
            )}
          </button>

          {showAlerts && (
            /* 5. UPDATED BACKGROUND: Changed from bg-white/80 to bg-white/98 and increased shadow contrast */
            <div className="absolute right-0 top-16 w-80 sm:w-96 bg-white/98 backdrop-blur-xl border border-gray-200/80 shadow-[0_20px_60px_rgba(0,0,0,0.18)] rounded-3xl p-5 z-50 animate-in fade-in slide-in-from-top-3 duration-300">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
                <span className="font-black text-xs text-gray-800 flex items-center gap-2 tracking-tight">
                  <ShieldAlert size={16} className={hasActiveAlerts ? "text-[#F28C28] animate-pulse" : "text-gray-400"} />
                  ACTIVE SYSTEM INCIDENTS
                </span>
                <button 
                  type="button" 
                  onClick={() => setShowAlerts(false)} 
                  aria-label="Close alerts panel"
                  className="text-gray-400 hover:text-gray-800 hover:bg-gray-100 p-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="py-8 text-center text-xs font-black text-gray-400 tracking-widest animate-pulse">
                    SYNCING DATA FEED...
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="py-10 flex flex-col items-center justify-center text-center opacity-70 animate-in fade-in zoom-in-95 duration-300">
                    <CheckCircle2 size={36} className="text-[#009B9E] mb-2" />
                    <p className="text-sm font-black text-gray-800">Atmosphere Nominal</p>
                    <p className="text-[11px] font-bold text-gray-400 mt-0.5">All local hardware grids reporting safe parameters.</p>
                  </div>
                ) : (
                  alerts.map((alert) => {
                    const isResolved = !!alert.resolvedAt;
                    const isBreach = alert.alertLevel?.toUpperCase() === "BREACHED";
                    
                    const themeClass = isResolved 
                      ? "bg-gray-50/60 border-gray-100 text-gray-600" 
                      : isBreach 
                        ? "bg-red-50/60 border-red-100 text-red-910 shadow-sm shadow-red-500/5" 
                        : "bg-amber-50/60 border-amber-100 text-amber-910 shadow-sm shadow-amber-500/5";

                    return (
                      <div key={alert.id} className={`p-4 rounded-2xl text-xs border transition-all duration-300 hover:translate-x-0.5 ${themeClass}`}>
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <div>
                            <span className="font-black text-sm block tracking-tight text-gray-800">{alert.siteName}</span>
                            {hasRole("Government") && (
                              <span className="font-bold opacity-50 text-[9px] uppercase tracking-wider block mt-0.5">{alert.companyName}</span>
                            )}
                          </div>
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-white shadow-sm border ${isResolved ? "border-gray-200 text-gray-400" : isBreach ? "border-red-200 text-red-600" : "border-amber-200 text-amber-600"}`}>
                            {isResolved ? "Resolved" : alert.alertLevel}
                          </span>
                        </div>
                        
                        <p className="opacity-90 font-semibold leading-relaxed text-gray-700">
                          Node parameter <strong className="font-black text-gray-900">{alert.pmType}</strong> {isResolved ? "stabilized below" : "exceeded"} limits. <br/>
                          Telemetry: <strong className="font-black text-gray-900">{alert.measuredValue}</strong> / Threshold: {alert.thresholdValue}
                        </p>
                        
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100/80">
                          <span className="text-[9px] font-bold opacity-50">{formatTime(alert.triggeredAt)}</span>
                          {alert.fined && (
                            <span className="text-[8px] font-black text-red-600 uppercase tracking-widest bg-red-100 px-2 py-0.5 rounded border border-red-200/50 shadow-sm">
                              Fine Issued
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}