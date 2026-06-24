// src/components/SiteDetailsModal.tsx
import { useState, useEffect } from "react";
import { X, Activity, BrainCircuit } from "lucide-react";
import axiosInstance from "@/app/api/axiosInstance";
import TelemetryChart, { HistoryDataPoint } from "./TelemetryChart";
import { SiteData } from "./SitesTable"; // Reusing your existing interface

interface SiteDetailsModalProps {
  site: SiteData;
  onClose: () => void;
}

interface RawHistoryDTO {
  timestamp: string;
  pm25: number;
  pm10: number;
}

export default function SiteDetailsModal({ site, onClose }: SiteDetailsModalProps) {
  const [history, setHistory] = useState<RawHistoryDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const res = await axiosInstance.get(`/sensors/site/${site.siteId}/history`);
        // Handle array unwrapping safely
        const data = Array.isArray(res) ? res : (res.data?.data || res.data || []);
        setHistory(data);
      } catch (error) {
        console.error("Failed to fetch site history:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [site.siteId]);

  // Format the raw backend data into the shape Recharts needs
  const pm25Data: HistoryDataPoint[] = history.map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: d.pm25
  }));

  const pm10Data: HistoryDataPoint[] = history.map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: d.pm10
  }));

  const handleForecastClick = () => {
    alert("AI Forecasting Module is currently initializing. This feature will be available in the next deployment update.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-gray-900/40 backdrop-blur-sm">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl bg-white rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <Activity className="text-[#005A8C]" />
              {site.name}
            </h2>
            <p className="text-sm font-semibold text-gray-500 mt-1">
              Node ID: {site.siteId} | {site.company}
            </p>
          </div>
          <button 
            type="button"
            aria-label="Close details"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          
          {/* Quick Stats Grid & Forecast Button */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap gap-4">
              <div className="bg-[#005A8C]/5 border border-[#005A8C]/10 rounded-xl px-5 py-3">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avg PM2.5</span>
                <p className="text-xl font-black text-[#005A8C]">{site.avgPm25 ?? "—"}</p>
              </div>
              <div className="bg-[#005A8C]/5 border border-[#005A8C]/10 rounded-xl px-5 py-3">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Peak PM2.5</span>
                <p className="text-xl font-black text-[#005A8C]">{site.maxPm25 ?? "—"}</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-3">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avg PM10</span>
                <p className="text-xl font-black text-gray-700">{site.avgPm10 ?? "—"}</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-3">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Peak PM10</span>
                <p className="text-xl font-black text-[#005A8C]">{site.maxPm10 ?? "—"}</p>
              </div>
            </div>

            {/* AI Forecast Placeholder Button */}
            <button 
              onClick={handleForecastClick}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
            >
              <BrainCircuit size={18} />
              AI Forecast (3H)
            </button>
          </div>

          {/* Charts Area */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center min-h-[300px]">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <div className="w-6 h-6 border-4 border-[#005A8C] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold tracking-widest uppercase animate-pulse">Loading Telemetry...</p>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-[300px] bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-sm font-bold text-gray-400">No historical data available for the last 12 hours.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TelemetryChart 
                title="PM2.5 Concentration (12H)"
                data={pm25Data}
                dataKey="PM2.5"
                lineColor="#009B9E"
                warningThreshold={30}
                breachThreshold={40}
              />
              <TelemetryChart 
                title="PM10 Concentration (12H)"
                data={pm10Data}
                dataKey="PM10"
                lineColor="#64748B"
                warningThreshold={75}
                breachThreshold={100}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}