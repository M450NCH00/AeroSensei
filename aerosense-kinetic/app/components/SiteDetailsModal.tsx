// src/components/SiteDetailsModal.tsx
import { useState, useEffect } from "react";
import { X, Activity, BrainCircuit, AlertCircle } from "lucide-react";
import axiosInstance from "@/app/api/axiosInstance";
import mlAxiosInstance from "@/app/api/mlAxiosInstance";
import TelemetryChart, { HistoryDataPoint } from "./TelemetryChart";
import { SiteData } from "./SitesTable";

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
  
  // New States for AI Forecasting
  const [isForecasting, setIsForecasting] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [forecastData, setForecastData] = useState<{
    pm25_1h: number; pm25_3h: number; pm10_1h: number; pm10_3h: number;
  } | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const res = await axiosInstance.get(`/sensors/site/${site.siteId}/history`);
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

  // Handle the ML API Call
  const handleForecastClick = async () => {
    setIsForecasting(true);
    setForecastError(null);
    try {
      // Look how clean this is! No base URL, just the specific route.
      const res = await mlAxiosInstance.get(`/predict/${site.siteId}`);
      
      // Axios already unwrapped the JSON into res.data
      const data = res.data; 
      
      setForecastData({
        pm25_1h: parseFloat(data.prediction[0]),
        pm25_3h: parseFloat(data.prediction[1]),
        pm10_1h: parseFloat(data.prediction[2]),
        pm10_3h: parseFloat(data.prediction[3]),
      });
    } catch (error) {
      console.error("ML API Error:", error);
      setForecastError("AI model failed to respond.");
    } finally {
      setIsForecasting(false);
    }
  };

  // --- DATA PIPELINE & STITCHING ---
  
  const formatTime = (isoString: string) => 
    new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. Map Historical Data
  const pm25Data: HistoryDataPoint[] = history.map(d => ({ time: formatTime(d.timestamp), value: d.pm25 }));
  const pm10Data: HistoryDataPoint[] = history.map(d => ({ time: formatTime(d.timestamp), value: d.pm10 }));

  // 2. Stitch the Forecast Data to the end of the arrays
  if (forecastData && history.length > 0) {
    const lastHistorical = history[history.length - 1];
    const lastTime = new Date(lastHistorical.timestamp);

    // Link the historical end-point to the forecast start-point so the line doesn't break
    pm25Data[pm25Data.length - 1].forecast = lastHistorical.pm25;
    pm10Data[pm10Data.length - 1].forecast = lastHistorical.pm10;

    // Calculate future timestamps (+1 hour and +3 hours)
    const t1 = new Date(lastTime.getTime() + 60 * 60 * 1000);
    const t3 = new Date(lastTime.getTime() + 3 * 60 * 60 * 1000);

    // Push the +1 Hour predictions
    pm25Data.push({ time: formatTime(t1.toISOString()), forecast: forecastData.pm25_1h });
    pm10Data.push({ time: formatTime(t1.toISOString()), forecast: forecastData.pm10_1h });

    // Push the +3 Hour predictions
    pm25Data.push({ time: formatTime(t3.toISOString()), forecast: forecastData.pm25_3h });
    pm10Data.push({ time: formatTime(t3.toISOString()), forecast: forecastData.pm10_3h });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-gray-900/40 backdrop-blur-sm">
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
              Node ID: {site.id} | {site.company}
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
                <p className="text-xl font-black text-gray-700">{site.maxPm10 ?? "—"}</p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button 
                type="button"
                onClick={handleForecastClick}
                disabled={isForecasting || forecastData !== null || history.length === 0}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isForecasting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</>
                ) : forecastData ? (
                  <><BrainCircuit size={18} /> Forecast Active</>
                ) : (
                  <><BrainCircuit size={18} /> Generate AI Forecast (3H)</>
                )}
              </button>
              
              {forecastError && (
                <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle size={14} /> {forecastError}
                </span>
              )}
            </div>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
              <TelemetryChart 
                title="PM2.5 Concentration"
                data={pm25Data}
                dataKey="PM2.5"
                lineColor="#009B9E"
                warningThreshold={30}
                breachThreshold={40}
              />
              <TelemetryChart 
                title="PM10 Concentration"
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