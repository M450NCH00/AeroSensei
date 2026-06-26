// src/components/DashboardHeader.tsx
"use client";

import { useState, useEffect } from "react";
import { Bell, Download, ShieldAlert, X, CheckCircle2 } from "lucide-react";
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

interface DashboardHeaderProps {
  onDownload: () => void;
  isDownloading: boolean;
}

export default function DashboardHeader({ onDownload, isDownloading }: DashboardHeaderProps) {
  const [showAlerts, setShowAlerts] = useState(false);
  const { hasRole } = useAuth();
  
  const [alerts, setAlerts] = useState<PmAlertResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch alerts automatically based on role
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

  // Safe time formatting
  const formatTime = (isoString: string | null) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleString([], { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  // Check if there are any active (unresolved) alerts to trigger the bouncing dot
  const hasActiveAlerts = alerts.some(a => a.resolvedAt === null);

  return (
    <header className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-gray-200/60 shadow-sm">
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
              : "bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50"
          }`}
        >
          <Bell size={20} />
          {/* FANCY TOUCH: Only bounce if there are actually unresolved alerts! */}
          {hasActiveAlerts && (
            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-[#F28C28] rounded-full ring-2 ring-white animate-bounce" />
          )}
        </button>

        {showAlerts && (
          <div className="absolute right-0 top-16 w-80 sm:w-96 bg-white/95 backdrop-blur-xl border border-gray-200 shadow-[0_10px_40px_rgba(0,0,0,0.12)] rounded-3xl p-5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <span className="font-black text-sm text-gray-800 flex items-center gap-2">
                <ShieldAlert size={18} className={hasActiveAlerts ? "text-[#F28C28]" : "text-gray-400"} />
                System Incidents
              </span>
              <button 
                type="button" 
                onClick={() => setShowAlerts(false)} 
                aria-label="Close alerts panel"
                className="text-gray-400 hover:text-gray-800 hover:bg-gray-100 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="py-6 text-center text-xs font-bold text-gray-400 animate-pulse">
                  Syncing incident reports...
                </div>
              ) : alerts.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center opacity-60">
                  <CheckCircle2 size={32} className="text-emerald-500 mb-2" />
                  <p className="text-sm font-black text-gray-700">All Clear</p>
                  <p className="text-xs font-semibold text-gray-500">No active or historical breaches.</p>
                </div>
              ) : (
                alerts.map((alert) => {
                  const isResolved = !!alert.resolvedAt;
                  const isBreach = alert.alertLevel?.toUpperCase() === "BREACHED";
                  
                  // Dynamic styling based on severity
                  const themeClass = isResolved 
                    ? "bg-gray-50 border-gray-200 text-gray-600" 
                    : isBreach 
                      ? "bg-red-50 border-red-200 text-red-900" 
                      : "bg-amber-50 border-amber-200 text-amber-900";

                  return (
                    <div key={alert.id} className={`p-4 rounded-2xl text-xs border ${themeClass}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-black text-sm block">{alert.siteName}</span>
                          {hasRole("Government") && (
                            <span className="font-bold opacity-60 text-[10px] uppercase tracking-wider">{alert.companyName}</span>
                          )}
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-white shadow-sm border ${isResolved ? "border-gray-200 text-gray-400" : isBreach ? "border-red-200 text-red-600" : "border-amber-200 text-amber-600"}`}>
                          {isResolved ? "Resolved" : alert.alertLevel}
                        </span>
                      </div>
                      
                      <p className="opacity-90 font-medium leading-relaxed">
                        <strong className="font-black">{alert.pmType}</strong> {isResolved ? "normalized after breaching" : "exceeded"} threshold. <br/>
                        Read: <strong className="font-black">{alert.measuredValue}</strong> / Limit: {alert.thresholdValue}
                      </p>
                      
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-black/5">
                        <span className="text-[10px] font-bold opacity-60">{formatTime(alert.triggeredAt)}</span>
                        {alert.fined && (
                          <span className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-100 px-2 py-0.5 rounded border border-red-200">
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

        <button 
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          className="flex items-center gap-2 px-5 py-3 bg-[#005A8C] text-white font-bold text-sm rounded-xl hover:bg-[#00426b] hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
        >
          <Download size={16} />
          {isDownloading ? "Generating..." : "Download Report"}
        </button>
      </div>
    </header>
  );
}