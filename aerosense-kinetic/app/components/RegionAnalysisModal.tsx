import { useState, useEffect } from "react";
import { X, Activity, BrainCircuit, AlertCircle } from "lucide-react";
import TelemetryChart, { HistoryDataPoint } from "./TelemetryChart";
import publicAxiosInstance from "@/app/api/publicAxiosInstance";

export interface SiteSensor15MinDTO {
  companyName: string;
  siteName: string;
  siteId: number;
  latitude: number;
  longitude: number;
  avgPm25: number;
  avgPm10: number;
  maxPm25: number;
  maxPm10: number;
  breachType: "NONE" | "PM2_5" | "PM10" | "MULTIPLE";
  state: "SAFE" | "WARNING" | "BREACHED";
  lastCalculated: string;
}

interface RegionAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  regionName: string;
  baseScore: number;
  lat: number;   // NEW PROPS FOR FORECAST API
  lng: number;
}

export default function RegionAnalysisModal({ isOpen, onClose, regionName, baseScore, lat, lng }: RegionAnalysisModalProps) {
  const [historyPM25, setHistoryPM25] = useState<HistoryDataPoint[]>([]);
  const [historyPM10, setHistoryPM10] = useState<HistoryDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isForecasting, setIsForecasting] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchRegionData = async () => {
      setIsLoading(true);
      try {
        const res = await publicAxiosInstance.get<SiteSensor15MinDTO[]>("/sensors/public/all-readings-15m");
        const allData = res.data;
        
        const formatTime = (isoString: string) => 
          new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const pm25Data: HistoryDataPoint[] = allData.map(d => ({ time: formatTime(d.lastCalculated), value: d.avgPm25 }));
        const pm10Data: HistoryDataPoint[] = allData.map(d => ({ time: formatTime(d.lastCalculated), value: d.avgPm10 }));

        setHistoryPM25(pm25Data);
        setHistoryPM10(pm10Data);
      } catch (error) {
        console.error("Failed to fetch public sensor telemetry:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRegionData();
  }, [isOpen, regionName]);

  const handleForecastClick = async () => {
    setIsForecasting(true);
    setForecastError(null);
    try {
      // NEW API TARGET WITH PARAMS
      const res = await publicAxiosInstance.get(`/sensors/public/forecast`, {
        params: { lat: lat, lon: lng }
      });
      const data = res.data; 

      const forecastData = {
        pm25_1h: parseFloat(data.prediction[0]),
        pm25_3h: parseFloat(data.prediction[1]),
        pm10_1h: parseFloat(data.prediction[2]),
        pm10_3h: parseFloat(data.prediction[3]),
      };

      if (historyPM25.length > 0 && historyPM10.length > 0) {
        const newPM25 = [...historyPM25];
        const newPM10 = [...historyPM10];

        const lastHistorical25 = newPM25[newPM25.length - 1];
        const lastHistorical10 = newPM10[newPM10.length - 1];

        // Bind the start of the dashed forecast line to the end of the solid history line
        lastHistorical25.forecast = lastHistorical25.value;
        lastHistorical10.forecast = lastHistorical10.value;

        const now = new Date();
        const t1 = new Date(now.getTime() + 60 * 60 * 1000);
        const t3 = new Date(now.getTime() + 3 * 60 * 60 * 1000);

        const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Push the new predicted points to the array
        newPM25.push({ time: formatTime(t1), forecast: forecastData.pm25_1h });
        newPM10.push({ time: formatTime(t1), forecast: forecastData.pm10_1h });

        newPM25.push({ time: formatTime(t3), forecast: forecastData.pm25_3h });
        newPM10.push({ time: formatTime(t3), forecast: forecastData.pm10_3h });

        setHistoryPM25(newPM25);
        setHistoryPM10(newPM10);
      }
    } catch (error) {
      console.error("API Error:", error);
      setForecastError("AI Core failed to respond.");
    } finally {
      setIsForecasting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm transition-opacity duration-300">
      <div className="relative w-full max-w-5xl bg-white/80 backdrop-blur-3xl border border-white/60 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/40 bg-white/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#005A8C] to-[#009B9E] flex items-center justify-center shadow-lg shadow-[#009B9E]/20">
              <Activity className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-[#005A8C]">
                {regionName} <span className="text-[#009B9E] font-medium">| Environmental Analysis</span>
              </h2>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-0.5">Coordinates: {lat.toFixed(4)}, {lng.toFixed(4)}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            title="Close Modal"
            className="p-2 bg-white/50 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all duration-300 shadow-sm border border-gray-100 group">
            <X size={20} className="text-gray-500 group-hover:text-red-500 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-10 h-10 border-4 border-[#009B9E]/20 border-t-[#005A8C] rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-[#005A8C] animate-pulse">Retrieving satellite telemetry...</p>
            </div>
          ) : historyPM25.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
              <AlertCircle size={32} className="opacity-50" />
              <p className="text-sm font-bold">No active sensors detected in this region.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white/50 border border-white/80 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <TelemetryChart title="PM2.5 Concentration (µg/m³)" data={historyPM25} dataKey="PM2.5" lineColor="#009B9E" warningThreshold={35} breachThreshold={55} />
              </div>

              <div className="bg-white/50 border border-white/80 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <TelemetryChart title="PM10 Concentration (µg/m³)" data={historyPM10} dataKey="PM10" lineColor="#005A8C" warningThreshold={50} breachThreshold={150} />
              </div>
            </div>
          )}
        </div>

        {/* Footer / AI Actions */}
        <div className="p-6 border-t border-white/40 bg-white/40 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
            {forecastError ? (
              <span className="text-red-500 flex items-center gap-1"><AlertCircle size={14} /> {forecastError}</span>
            ) : (
              <><AlertCircle size={14} className="text-[#009B9E]" /> Live Data Sync Active</>
            )}
          </div>
          <button
            onClick={handleForecastClick}
            disabled={isForecasting || isLoading || historyPM25.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#005A8C] to-[#009B9E] text-white text-sm font-black tracking-wide rounded-xl hover:shadow-[0_8px_25px_rgba(0,155,158,0.4)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {isForecasting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <BrainCircuit size={18} className={historyPM25.length > 0 ? "animate-pulse" : ""} />
            )}
            {isForecasting ? "Processing Deep Learning..." : "Run AI Forecast (3H)"}
          </button>
        </div>

      </div>
    </div>
  );
}