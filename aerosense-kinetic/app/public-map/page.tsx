"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Search, MapPin, BrainCircuit, X, Activity, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { SiteSensor15MinDTO } from "@/app/components/PublicMapCanvas";

const DynamicMap = dynamic(() => import("@/app/components/PublicMapCanvas"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#F1F5F9]">
      <div className="flex flex-col items-center gap-4 text-[#009B9E]">
        <div className="w-12 h-12 border-4 border-[#009B9E]/20 border-t-[#009B9E] rounded-full animate-spin shadow-[0_0_15px_rgba(0,155,158,0.3)]" />
        <p className="font-black tracking-widest uppercase text-sm animate-pulse">Initializing Global Matrix...</p>
      </div>
    </div>
  )
});

const getMOHAdvice = (pm25: number) => {
  if (pm25 <= 55) return { 
    band: "Normal (Band I)", 
    color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/30",
    advice: "Normal activities can be continued safely." 
  };
  if (pm25 <= 150) return { 
    band: "Elevated (Band II)", 
    color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/30",
    advice: "Reduce prolonged or strenuous outdoor physical exertion." 
  };
  if (pm25 <= 250) return { 
    band: "High (Band III)", 
    color: "text-red-600", bg: "bg-red-500/10", border: "border-red-500/30",
    advice: "Avoid prolonged/strenuous outdoor physical exertion. Elderly, pregnant women, and children should minimize outdoor activity." 
  };
  return { 
    band: "Very High (Band IV)", 
    color: "text-purple-600", bg: "bg-purple-500/10", border: "border-purple-500/30",
    advice: "Minimize all outdoor activities. Wear an N95 mask if you must go outside." 
  };
};

export default function PublicMapPage() {
  const [sites, setSites] = useState<SiteSensor15MinDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [targetCoords, setTargetCoords] = useState<[number, number] | null>(null);
  
  const [selectedSite, setSelectedSite] = useState<SiteSensor15MinDTO | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [forecast, setForecast] = useState<{pm25_1h: number, pm10_1h: number} | null>(null);

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/";
        const res = await fetch(`${apiUrl}/api/sensors/public/all-readings-15m`);
        
        if (!res.ok) {
          const errorDetails = await res.text();
          throw new Error(`Server rejected request with status ${res.status}: ${errorDetails}`);
        }
        
        const data = await res.json();
        setSites(data);
      } catch (error) {
        console.error("Failed to load public telemetry", error);
      }
    };
    fetchPublicData();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        setTargetCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      }
    } catch (error) {
      console.error("Geocoding failed", error);
    }
  };

  const handleSiteClick = async (site: SiteSensor15MinDTO) => {
    setSelectedSite(site);
    setForecast(null);
    setIsPredicting(true);

    try {
      const mlUrl = process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:5001";
      const res = await fetch(`${mlUrl}/predict/${site.siteId}`);
      if (!res.ok) throw new Error("ML Failed");
      const data = await res.json();
      
      setForecast({
        pm25_1h: parseFloat(data.prediction[0]),
        pm10_1h: parseFloat(data.prediction[2]),
      });
    } catch (error) {
      console.error("Prediction failed", error);
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    // FANCY UPGRADE: Converted entire page base to bright mode
    <div className="h-screen w-full relative overflow-hidden bg-[#F1F5F9] font-sans select-none">
      
      {/* BACKGROUND AURA (Bright Mode Variations) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-[#009B9E]/20 rounded-full mix-blend-multiply blur-3xl opacity-60 animate-blob-shift" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-[#005A8C]/15 rounded-full mix-blend-multiply blur-3xl opacity-50 animate-blob-shift animation-delay-2000" />
      </div>

      <div className="absolute inset-0 z-0">
        <DynamicMap sites={sites} onSiteClick={handleSiteClick} targetCoords={targetCoords} />
      </div>

      {/* TOP FLOATING NAVIGATION & SEARCH (Bright Mode) */}
      <div className="absolute top-0 w-full p-4 md:p-8 z-20 flex flex-col md:flex-row items-center justify-between gap-4 pointer-events-none">
        
        <Link href="/" className="pointer-events-auto">
          <div className="font-black text-2xl tracking-widest text-[#005A8C] drop-shadow-sm hover:scale-105 transition-transform">
            AERO<span className="text-[#009B9E]">SENSE</span>
          </div>
        </Link>

        {/* FANCY UPGRADE: Bright Glassmorphism Search Pill */}
        <div className="pointer-events-auto flex w-full md:w-[450px] bg-white/70 backdrop-blur-xl border border-white/80 p-2 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all focus-within:bg-white/90 focus-within:shadow-[0_8px_40px_rgba(0,90,140,0.1)]">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search city, region, or landmark..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-11 pr-4 py-3 bg-transparent text-sm font-bold text-gray-800 placeholder:text-gray-400 focus:outline-none"
            />
          </div>
          <button 
            type="button"
            onClick={handleSearch}
            className="px-6 bg-[#009B9E] text-white text-xs font-black tracking-widest uppercase rounded-full hover:bg-[#007B7E] transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            Locate
          </button>
        </div>
      </div>

      {/* HOLOGRAPHIC SITE DETAILS MODAL (Bright Mode) */}
      {selectedSite && (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm pointer-events-auto">
          <div className="absolute inset-0" onClick={() => setSelectedSite(null)} />
          
          <div className="relative w-full max-w-lg bg-white/80 backdrop-blur-3xl border border-white/60 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            
            <div className="p-6 border-b border-gray-100/50 flex items-start justify-between bg-white/40">
              <div>
                <h2 className="text-2xl font-black text-[#005A8C] flex items-center gap-2 tracking-tight">
                  <MapPin className="text-[#009B9E]" size={24} /> {selectedSite.siteName}
                </h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  {selectedSite.companyName} | Lat: {selectedSite.latitude.toFixed(2)} Lon: {selectedSite.longitude.toFixed(2)}
                </p>
              </div>
              <button 
                type="button"
                title="Close details"
                aria-label="Close details"
                onClick={() => setSelectedSite(null)} 
                className="p-2 text-gray-400 hover:text-gray-800 bg-white/50 hover:bg-white rounded-full transition-all shadow-sm"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/60 border border-white shadow-sm rounded-2xl p-4 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current PM2.5</span>
                  <p className="text-3xl font-black text-[#005A8C]">{selectedSite.avgPm25}</p>
                </div>
                <div className="bg-white/60 border border-white shadow-sm rounded-2xl p-4 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current PM10</span>
                  <p className="text-3xl font-black text-gray-700">{selectedSite.avgPm10}</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-white/80 to-white/40 border border-white shadow-[0_8px_30px_rgba(0,90,140,0.05)] rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-[-50%] right-[-10%] w-32 h-32 bg-[#009B9E]/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center gap-2 mb-4 relative z-10">
                  <BrainCircuit className="text-[#009B9E]" size={20} />
                  <h3 className="font-black text-sm text-[#009B9E] tracking-widest uppercase">AI Agent 1-Hour Forecast</h3>
                </div>

                {isPredicting ? (
                  <div className="flex items-center justify-center py-6 gap-3 relative z-10">
                    <div className="w-5 h-5 border-2 border-[#009B9E]/20 border-t-[#009B9E] rounded-full animate-spin" />
                    <span className="text-xs font-bold text-[#009B9E] animate-pulse">Running Neural Models...</span>
                  </div>
                ) : forecast ? (
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Predicted PM2.5</span>
                      <span className="text-2xl font-black text-[#005A8C]">{forecast.pm25_1h.toFixed(1)}</span>
                    </div>
                    <Activity className="text-gray-200" size={32} />
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Predicted PM10</span>
                      <span className="text-2xl font-black text-gray-700">{forecast.pm10_1h.toFixed(1)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-red-500 font-bold relative z-10">Prediction unavailable.</p>
                )}
              </div>

              {(() => {
                const targetValue = forecast ? forecast.pm25_1h : selectedSite.avgPm25;
                const advice = getMOHAdvice(targetValue);
                
                return (
                  <div className={`${advice.bg} border ${advice.border} rounded-2xl p-5 flex flex-col gap-2 shadow-sm`}>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className={advice.color} size={18} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${advice.color}`}>MOH Advisory: {advice.band}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 leading-relaxed">
                      {advice.advice}
                    </p>
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}