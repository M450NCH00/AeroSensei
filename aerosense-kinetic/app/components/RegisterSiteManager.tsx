// src/components/RegisterSiteManager.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Building, MapPin, Search, CheckCircle2, AlertCircle, ChevronDown, Layers, Map } from "lucide-react";
import axiosInstance from "@/app/api/axiosInstance";

const DynamicMapPicker = dynamic(() => import("./InteractiveMapPicker"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex-1 bg-white/40 backdrop-blur-md animate-pulse flex flex-col items-center justify-center text-[#005A8C] gap-3">
      <Map size={32} className="animate-bounce" />
      <span className="font-black text-xs tracking-widest uppercase">Initializing Geospatial Engine...</span>
    </div>
  )
});

interface Company {
  id: number;
  companyName: string;
}

interface Site {
  id: number;
  siteName: string;
  latitude: number | null;
  longitude: number | null;
}

export default function RegisterSiteManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("");
  const [existingSites, setExistingSites] = useState<Site[]>([]);
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [siteName, setSiteName] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  
  const [showExistingSites, setShowExistingSites] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await axiosInstance.get("/companies");
        if (Array.isArray(res)) setCompanies(res);
        else if (res.data && Array.isArray(res.data)) setCompanies(res.data);
        else if (res.data && Array.isArray(res.data.data)) setCompanies(res.data.data);
      } catch (error) {
        console.error("Failed to fetch companies", error);
      }
    };
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) {
      setExistingSites([]);
      return;
    }
    const fetchSites = async () => {
      try {
        const res = await axiosInstance.get(`/companies/${selectedCompanyId}/sites`);
        if (Array.isArray(res)) setExistingSites(res);
        else if (res.data && Array.isArray(res.data)) setExistingSites(res.data);
        else if (res.data && Array.isArray(res.data.data)) setExistingSites(res.data.data);
      } catch (error) {
        console.error("Failed to fetch sites", error);
      }
    };
    fetchSites();
  }, [selectedCompanyId]);

  const handleAddressSearch = async () => {
    if (!searchQuery) return;
    setIsSearchingMap(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        setLat(parseFloat(data[0].lat));
        setLng(parseFloat(data[0].lon));
      } else {
        alert("Location not found.");
      }
    } catch (error) {
      console.error("Geocoding failed", error);
    } finally {
      setIsSearchingMap(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !siteName || lat === null || lng === null) return;

    try {
      await axiosInstance.post("/companies/register", {
        companyId: selectedCompanyId,
        siteName,
        latitude: lat,
        longitude: lng
      });
      
      setStatusMsg({ text: `Successfully registered ${siteName}!`, type: "success" });
      setSiteName("");
      setLat(null);
      setLng(null);
      setSearchQuery("");
      
      const res = await axiosInstance.get(`/companies/${selectedCompanyId}/sites`);
      if (Array.isArray(res)) setExistingSites(res);
      else if (res.data && Array.isArray(res.data)) setExistingSites(res.data);
      
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (error) {
      setStatusMsg({ text: "Failed to register site.", type: "error" });
    }
  };

  const isFormValid = siteName.trim().length > 0 && lat !== null && lng !== null;
  const selectedCompanyName = companies.find(c => c.id === selectedCompanyId)?.companyName || "-- Choose an Organization --";

  return (
    <div className="flex flex-col xl:flex-row gap-5 min-h-full p-2">
      
      {/* LEFT COLUMN */}
      <aside className="w-full xl:w-1/3 bg-white/40 backdrop-blur-md rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-white/60 p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-black text-gray-800 flex items-center gap-2 mb-4 tracking-tight">
            <div className="p-2 bg-white/60 rounded-xl shadow-sm border border-white">
              <Building className="text-[#005A8C]" size={18} />
            </div>
            Company Profile
          </h2>
          
          <div className="space-y-1.5 relative" ref={dropdownRef}>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Select Organization</label>
            
            <button 
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between bg-white/60 backdrop-blur-sm border border-white/80 shadow-sm rounded-xl px-4 py-3 text-sm font-bold text-gray-700 hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#009B9E]/50 transition-all duration-300"
            >
              <span className="truncate">{selectedCompanyName}</span>
              <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${isDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white/95 backdrop-blur-3xl border border-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl py-2 z-50 max-h-60 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300/50 [&::-webkit-scrollbar-thumb]:rounded-full">
                <button
                  type="button"
                  onClick={() => { setSelectedCompanyId(""); setIsDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-400 hover:bg-gray-50 transition-colors"
                >
                  -- Clear Selection --
                </button>
                {companies.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedCompanyId(c.id); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-all ${
                      selectedCompanyId === c.id 
                        ? "bg-[#009B9E]/10 text-[#009B9E] border-l-4 border-[#009B9E]" 
                        : "text-gray-700 hover:bg-gray-50 border-l-4 border-transparent hover:border-gray-200"
                    }`}
                  >
                    {c.companyName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedCompanyId && (
          <div className="flex-1 flex flex-col min-h-0 border-t border-white/50 pt-4">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Currently Active Sites</label>
            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300/50 [&::-webkit-scrollbar-thumb]:rounded-full">
              {existingSites.length === 0 ? (
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-white/40 p-4 rounded-xl text-center border border-dashed border-gray-300/50">No sites deployed</p>
              ) : (
                existingSites.map(site => (
                  <div key={site.id} className="p-3 bg-white/50 backdrop-blur-sm border border-white/60 rounded-xl flex items-center justify-between group hover:bg-white/80 hover:shadow-sm transition-all duration-300 cursor-default">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-[#009B9E]/10 rounded-md group-hover:bg-[#009B9E]/20 transition-colors">
                        <MapPin size={14} className="text-[#009B9E]" />
                      </div>
                      <span className="font-bold text-xs text-gray-800 truncate max-w-[120px]">{site.siteName}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </aside>

      {/* RIGHT COLUMN */}
      <div className="w-full xl:w-2/3 bg-white/50 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-white/60 p-5 sm:p-6 flex flex-col min-h-0">
        <h2 className="text-xl font-black text-gray-800 mb-4 border-b border-white/60 pb-3 shrink-0 tracking-tight">Register New Location</h2>
        
        {!selectedCompanyId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-white/60 border border-white shadow-xl rounded-full flex items-center justify-center mb-5 relative">
              <div className="absolute inset-0 bg-[#005A8C]/5 rounded-full animate-ping opacity-50" />
              <Building size={32} className="text-[#005A8C]/40" />
            </div>
            <h3 className="text-lg font-black text-gray-500 tracking-tight">Select an Organization</h3>
            <p className="text-xs font-bold text-gray-400 mt-2 max-w-xs">Connect to a corporate profile before deploying infrastructure.</p>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300/50 [&::-webkit-scrollbar-thumb]:rounded-full">
            
            {statusMsg && (
              <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold shrink-0 shadow-sm border ${statusMsg.type === "success" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" : "bg-red-500/10 text-red-700 border-red-500/30"}`}>
                {statusMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {statusMsg.text}
              </div>
            )}

            {/* Row 1: Site Name */}
            <div className="space-y-1.5 shrink-0">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Site Designation Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="e.g., Da Nang Industrial Complex"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009B9E]/50 focus:bg-white/90 shadow-sm transition-all duration-300"
              />
            </div>

            {/* Row 2: Search Coordinates */}
            <div className="space-y-1.5 shrink-0">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Geospatial Search</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search address or landmark..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddressSearch())}
                    className="w-full pl-10 pr-3 py-2.5 bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl text-sm font-bold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009B9E]/50 focus:bg-white/90 shadow-sm transition-all duration-300"
                  />
                </div>
                <button 
                  type="button" 
                  onClick={handleAddressSearch}
                  disabled={isSearchingMap || !searchQuery}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#005A8C] to-[#0070ab] text-white text-xs font-black tracking-widest uppercase rounded-xl hover:shadow-[0_8px_15px_rgba(0,90,140,0.2)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:shadow-none sm:w-auto w-full shrink-0"
                >
                  {isSearchingMap ? "Scanning..." : "Locate"}
                </button>
              </div>
            </div>

            {/* Row 3: Coordinate Readouts */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className={`border rounded-xl px-4 py-2 flex flex-col justify-center transition-all duration-500 ${lat === null ? "bg-red-500/5 border-red-500/20 shadow-[inset_0_0_15px_rgba(239,68,68,0.05)]" : "bg-white/60 border-white/80 shadow-sm"}`}>
                <span className={`text-[9px] font-black uppercase tracking-widest ${lat === null ? "text-red-400" : "text-gray-400"}`}>Latitude</span>
                <span className={`text-sm font-black tracking-tight mt-0.5 ${lat === null ? "text-red-500" : "text-[#005A8C]"}`}>
                  {lat !== null ? lat.toFixed(6) : "REQUIRED"}
                </span>
              </div>
              <div className={`border rounded-xl px-4 py-2 flex flex-col justify-center transition-all duration-500 ${lng === null ? "bg-red-500/5 border-red-500/20 shadow-[inset_0_0_15px_rgba(239,68,68,0.05)]" : "bg-white/60 border-white/80 shadow-sm"}`}>
                <span className={`text-[9px] font-black uppercase tracking-widest ${lng === null ? "text-red-400" : "text-gray-400"}`}>Longitude</span>
                <span className={`text-sm font-black tracking-tight mt-0.5 ${lng === null ? "text-red-500" : "text-[#005A8C]"}`}>
                  {lng !== null ? lng.toFixed(6) : "REQUIRED"}
                </span>
              </div>
            </div>

            {/* Row 4: Map Canvas - Set to flex-1 so it absorbs remaining space cleanly */}
            <div className="flex-1 min-h-[220px] rounded-2xl overflow-hidden border border-white/80 shadow-sm isolate shrink-0">
              <DynamicMapPicker 
                lat={lat} 
                lng={lng} 
                onLocationSelect={(newLat, newLng) => {
                  setLat(newLat);
                  setLng(newLng);
                }} 
                existingSites={existingSites}
                showExistingSites={showExistingSites}
              />
            </div>

            {/* FANCY UPGRADE: Unified Action Bar (STRICTLY outside map wrapper) */}
            <div className="mt-2 pt-4 border-t border-white/50 flex flex-col md:flex-row items-center justify-between shrink-0 gap-3">
              
              <div className="flex flex-col items-start gap-1 w-full md:w-auto">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Select canvas to pin matrix.</p>
                {!isFormValid ? (
                  <span className="text-[9px] font-black tracking-widest uppercase text-red-500 flex items-center gap-1.5 bg-red-500/10 px-2.5 py-1 rounded-md border border-red-500/20">
                    <AlertCircle size={12} /> Missing Parameters
                  </span>
                ) : (
                  <span className="text-[9px] font-black tracking-widest uppercase text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                    <CheckCircle2 size={12} /> Ready for Deployment
                  </span>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                {existingSites.length > 0 && (
                  <div className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md px-4 h-10 rounded-xl border border-white/80 shadow-sm hover:bg-white/80 transition-colors w-full sm:w-auto">
                    <input
                      type="checkbox"
                      id="toggleSites"
                      checked={showExistingSites}
                      onChange={(e) => setShowExistingSites(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#009B9E] cursor-pointer"
                    />
                    <label htmlFor="toggleSites" className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-1 cursor-pointer select-none">
                      <Layers size={14} className="text-[#005A8C]" />
                      Show Existing
                    </label>
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={!isFormValid}
                  className="w-full sm:w-auto px-6 h-10 flex items-center justify-center bg-gradient-to-r from-[#009B9E] to-[#007B7E] text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-[0_8px_20px_rgba(0,155,158,0.25)] hover:shadow-[0_12px_25px_rgba(0,155,158,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 disabled:cursor-not-allowed group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                  Deploy New Site
                </button>
              </div>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}