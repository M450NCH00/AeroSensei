// src/components/SiteDetailsModal.tsx
import { useState, useEffect } from "react";
import { X, Activity, BrainCircuit, AlertCircle } from "lucide-react";
import axiosInstance from "@/app/api/axiosInstance";
import mlAxiosInstance from "@/app/api/mlAxiosInstance";
import TelemetryChart, { HistoryDataPoint } from "./TelemetryChart";
import { SiteData } from "./SitesTable";
import RollingNumber from "./RollingNumber"; // 1. Import RollingNumber!

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

  const handleForecastClick = async () => {
    setIsForecasting(true);
    setForecastError(null);
    try {
      const res = await mlAxiosInstance.get(`/predict/${site.siteId}`);
      const data = res.data; 
      
      setForecastData({
        pm25_1h: parseFloat(data.prediction[0]),
        pm25_3h: parseFloat(data.prediction[1]),
        pm10_1h: parseFloat(data.prediction[2]),
        pm10_3h: parseFloat(data.prediction[3]),
      });
    } catch (error) {
      console.error("ML API Error:", error);
      setForecastError("AI Core failed to respond.");
    } finally {
      setIsForecasting(false);
    }
  };

  const formatTime = (isoString: string) => 
    new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const pm25Data: HistoryDataPoint[] = history.map(d => ({ time: formatTime(d.timestamp), value: d.pm25 }));
  const pm10Data: HistoryDataPoint[] = history.map(d => ({ time: formatTime(d.timestamp), value: d.pm10 }));

  if (forecastData && history.length > 0) {
    const lastHistorical = history[history.length - 1];
    const lastTime = new Date(lastHistorical.timestamp);

    pm25Data[pm25Data.length - 1].forecast = lastHistorical.pm25;
    pm10Data[pm10Data.length - 1].forecast = lastHistorical.pm10;

    const t1 = new Date(lastTime.getTime() + 60 * 60 * 1000);
    const t3 = new Date(lastTime.getTime() + 3 * 60 * 60 * 1000);

    pm25Data.push({ time: formatTime(t1.toISOString()), forecast: forecastData.pm25_1h });
    pm10Data.push({ time: formatTime(t1.toISOString()), forecast: forecastData.pm10_1h });

    pm25Data.push({ time: formatTime(t3.toISOString()), forecast: forecastData.pm25_3h });
    pm10Data.push({ time: formatTime(t3.toISOString()), forecast: forecastData.pm10_3h });
  }

  return (
    // FANCY UPGRADE: Deepened the backdrop blur to keep focus entirely on the modal
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-slate-900/50 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* FANCY UPGRADE: The Holographic Modal Container */}
      <div className="relative w-full max-w-6xl bg-white/80 backdrop-blur-3xl border border-white/80 shadow-[0_20px_70px_rgba(0,0,0,0.2)] rounded-[2.5rem] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Subtle internal aura for the modal */}
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-[#009B9E]/10 rounded-full blur-3xl pointer-events-none" />

        {/* HEADER */}
        <div className="relative z-10 flex items-start sm:items-center justify-between p-6 sm:px-10 sm:py-8 border-b border-white/50">
          <div>
            <h2 className="text-3xl font-black text-[#005A8C] flex items-center gap-3 tracking-tight">
              <div className="p-2.5 bg-white/60 border border-white shadow-sm rounded-2xl">
                <Activity size={24} className="text-[#009B9E]" />
              </div>
              {site.name}
              
              {/* Glowing Status Dot aligned with the Header style */}
              <span className="relative flex h-3 w-3 ml-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  site.state === "BREACHED" ? "bg-red-500" : site.state === "WARNING" ? "bg-amber-500" : "bg-[#009B9E]"
                }`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  site.state === "BREACHED" ? "bg-red-500" : site.state === "WARNING" ? "bg-amber-500" : "bg-[#009B9E]"
                }`}></span>
              </span>
            </h2>
            <p className="text-sm font-bold text-gray-500 mt-2 uppercase tracking-widest bg-white/50 px-3 py-1 rounded-lg border border-white/60 w-max shadow-sm">
              Node ID: {site.id} <span className="mx-2 text-gray-300">|</span> {site.company}
            </p>
          </div>
          <button 
            type="button"
            aria-label="Close details"
            onClick={onClose}
            className="p-3 text-gray-400 bg-white/50 border border-white/60 hover:text-gray-800 hover:bg-white shadow-sm hover:shadow-md rounded-2xl transition-all duration-300 active:scale-95 shrink-0"
          >
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        {/* BODY */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col gap-8 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300/50 [&::-webkit-scrollbar-thumb]:rounded-full">
          
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
            
            {/* FANCY UPGRADE: Floating Glass Metric Cards */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-4 w-full xl:w-auto">
              
              <div className="bg-white/60 backdrop-blur-md border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] rounded-2xl px-5 py-4 flex flex-col justify-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Avg PM2.5</span>
                <p className="text-2xl font-black text-[#005A8C]">
                  {/* FANCY UPGRADE: Integrated RollingNumber */}
                  <RollingNumber value={site.avgPm25} decimals={1} />
                </p>
              </div>
              
              <div className="bg-white/60 backdrop-blur-md border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] rounded-2xl px-5 py-4 flex flex-col justify-center relative overflow-hidden">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 relative z-10">Peak PM2.5</span>
                <p className="text-2xl font-black text-[#005A8C] relative z-10">
                  <RollingNumber value={site.maxPm25} decimals={1} />
                </p>
                {/* Subtle warning glow if peak is high */}
                {(site.maxPm25 ?? 0) > 35 && <div className="absolute inset-0 bg-red-500/5 z-0" />}
              </div>
              
              <div className="bg-white/60 backdrop-blur-md border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] rounded-2xl px-5 py-4 flex flex-col justify-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Avg PM10</span>
                <p className="text-2xl font-black text-gray-700">
                  <RollingNumber value={site.avgPm10} decimals={1} />
                </p>
              </div>
              
              <div className="bg-white/60 backdrop-blur-md border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] rounded-2xl px-5 py-4 flex flex-col justify-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Peak PM10</span>
                <p className="text-2xl font-black text-gray-700">
                  <RollingNumber value={site.maxPm10} decimals={1} />
                </p>
              </div>

            </div>

            {/* FANCY UPGRADE: Premium AI Forecast Button */}
            <div className="flex flex-col items-start xl:items-end gap-2 w-full xl:w-auto shrink-0">
              <button 
                type="button"
                onClick={handleForecastClick}
                disabled={isForecasting || forecastData !== null || history.length === 0}
                className="w-full xl:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-[#005A8C] to-[#009B9E] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_10px_30px_rgba(0,155,158,0.2)] transition-all hover:shadow-[0_10px_40px_rgba(0,155,158,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:cursor-not-allowed group relative overflow-hidden"
              >
                {/* Button Glare Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                
                {isForecasting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing Core Data...</>
                ) : forecastData ? (
                  <><BrainCircuit size={18} /> Forecast Active</>
                ) : (
                  <><BrainCircuit size={18} className="group-hover:animate-pulse" /> Generate AI Forecast (3H)</>
                )}
              </button>
              
              <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                Powered by Open-Meteo
              </span>

              {forecastError && (
                <span className="text-[10px] font-black tracking-widest uppercase text-red-500 flex items-center gap-1.5 bg-red-50/80 px-3 py-1.5 rounded-lg border border-red-100">
                  <AlertCircle size={14} /> {forecastError}
                </span>
              )}
            </div>
          </div>

          {/* Charts Area */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center min-h-[350px]">
              <div className="flex flex-col items-center gap-4 text-gray-400">
                <div className="w-8 h-8 border-4 border-[#005A8C] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-black tracking-widest uppercase animate-pulse">Syncing Array Data...</p>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-[350px] bg-white/40 rounded-[2rem] border border-dashed border-gray-300/50">
              <p className="text-xs font-black tracking-widest uppercase text-gray-400 opacity-70">No historical data available for the last 12 hours.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="bg-white/40 backdrop-blur-sm border border-white/60 p-4 rounded-3xl shadow-sm hover:bg-white/60 transition-colors duration-500">
                <TelemetryChart 
                  title="PM2.5 Concentration"
                  data={pm25Data}
                  dataKey="PM2.5"
                  lineColor="#009B9E"
                  warningThreshold={30}
                  breachThreshold={40}
                />
              </div>
              <div className="bg-white/40 backdrop-blur-sm border border-white/60 p-4 rounded-3xl shadow-sm hover:bg-white/60 transition-colors duration-500">
                <TelemetryChart 
                  title="PM10 Concentration"
                  data={pm10Data}
                  dataKey="PM10"
                  lineColor="#64748B"
                  warningThreshold={75}
                  breachThreshold={100}
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}