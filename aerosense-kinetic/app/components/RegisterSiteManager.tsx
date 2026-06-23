// src/components/RegisterSiteManager.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Building, MapPin, Search, CheckCircle2, AlertCircle, ChevronDown, Layers } from "lucide-react";
import axiosInstance from "@/app/api/axiosInstance";

const DynamicMapPicker = dynamic(() => import("./InteractiveMapPicker"), {
  ssr: false,
  loading: () => <div className="w-full min-h-[350px] flex-1 bg-gray-50 rounded-xl animate-pulse border border-gray-100 flex items-center justify-center text-gray-400 font-bold text-sm">LOADING MAP ENGINE...</div>
});

interface Company {
  id: number;
  companyName: string;
}

// 1. Updated interface to include coordinates from the backend
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
  
  // 2. State for the visibility toggle
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
  const selectedCompanyName = companies.find(c => c.id === selectedCompanyId)?.companyName || "-- Choose a Company --";

  return (
    // Changed to min-h-full so the layout can flex correctly without bleeding outside
    <div className="flex flex-col xl:flex-row gap-6 min-h-full">
      
      {/* LEFT COLUMN */}
      <aside className="w-full xl:w-1/3 bg-white rounded-[2rem] shadow-sm border border-gray-200/60 p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 mb-4">
            <Building className="text-[#005A8C]" size={24} />
            Company Profile
          </h2>
          
          <div className="space-y-2 relative" ref={dropdownRef}>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Organization</label>
            
            <button 
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#009B9E]/50 focus:border-[#009B9E] transition-all"
            >
              <span className="truncate">{selectedCompanyName}</span>
              <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-gray-100 shadow-xl rounded-xl py-2 z-50 max-h-60 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { setSelectedCompanyId(""); setIsDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  -- Clear Selection --
                </button>
                {companies.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedCompanyId(c.id); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm font-bold transition-colors ${selectedCompanyId === c.id ? "bg-[#009B9E]/10 text-[#009B9E]" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    {c.companyName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedCompanyId && (
          <div className="flex-1 flex flex-col min-h-0 border-t border-gray-100 pt-6">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Currently Active Sites</label>
            <div className="space-y-2 overflow-y-auto flex-1 pr-2">
              {existingSites.length === 0 ? (
                <p className="text-sm font-semibold text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center">No sites registered yet.</p>
              ) : (
                existingSites.map(site => (
                  <div key={site.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <MapPin size={16} className="text-[#009B9E]" />
                      <span className="font-bold text-sm text-gray-700 truncate max-w-[150px]">{site.siteName}</span>
                    </div>
                    {/* Tiny coordinates indicator in the list */}
                    {site.latitude && site.longitude && (
                      <span className="text-[10px] font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {site.latitude.toFixed(2)}, {site.longitude.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </aside>

      {/* RIGHT COLUMN */}
      <div className="w-full xl:w-2/3 bg-white rounded-[2rem] shadow-sm border border-gray-200/60 p-8 flex flex-col min-h-0">
        <h2 className="text-2xl font-black text-gray-800 mb-6 border-b border-gray-100 pb-4 shrink-0">Register New Location</h2>
        
        {!selectedCompanyId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <Building size={48} className="text-gray-200 mb-4" />
            <h3 className="text-lg font-bold text-gray-400">Select a company first</h3>
            <p className="text-sm text-gray-400 mt-2">You must select an organization from the sidebar before registering a new site.</p>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
            
            {statusMsg && (
              <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold shrink-0 ${statusMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {statusMsg.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {statusMsg.text}
              </div>
            )}

            <div className="space-y-2 shrink-0">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Site Designation Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="e.g., Da Nang Industrial Complex"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#009B9E]/50 focus:border-[#009B9E] transition-all"
              />
            </div>

            <div className="flex flex-col flex-1 min-h-[400px] gap-4">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0">Geospatial Coordinates <span className="text-red-500">*</span></label>
              
              <div className="flex gap-2 shrink-0">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Type an address to autofill coordinates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddressSearch())}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#009B9E]/50 focus:border-[#009B9E] transition-all"
                  />
                </div>
                <button 
                  type="button" 
                  onClick={handleAddressSearch}
                  disabled={isSearchingMap || !searchQuery}
                  className="px-6 py-3 bg-[#005A8C] text-white text-sm font-bold rounded-xl hover:bg-[#00466e] transition-colors disabled:opacity-50"
                >
                  {isSearchingMap ? "Searching..." : "Locate"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 shrink-0">
                <div className={`border rounded-xl px-4 py-2 flex flex-col justify-center transition-colors ${lat === null ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Latitude</span>
                  <span className={`text-sm font-black ${lat === null ? "text-red-500" : "text-[#005A8C]"}`}>
                    {lat !== null ? lat.toFixed(6) : "Required"}
                  </span>
                </div>
                <div className={`border rounded-xl px-4 py-2 flex flex-col justify-center transition-colors ${lng === null ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Longitude</span>
                  <span className={`text-sm font-black ${lng === null ? "text-red-500" : "text-[#005A8C]"}`}>
                    {lng !== null ? lng.toFixed(6) : "Required"}
                  </span>
                </div>
              </div>

              {/* 3. The Map and Checkbox Container */}
              <div className="flex flex-col flex-1 gap-2">
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
                
                <div className="flex items-center justify-between shrink-0 px-1">
                  <p className="text-xs font-semibold text-gray-400">Click anywhere to pin exact location.</p>
                  
                  {/* The visibility toggle! */}
                  {existingSites.length > 0 && (
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                      <input
                        type="checkbox"
                        id="toggleSites"
                        checked={showExistingSites}
                        onChange={(e) => setShowExistingSites(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#009B9E] cursor-pointer"
                      />
                      <label htmlFor="toggleSites" className="text-xs font-bold text-gray-600 flex items-center gap-1 cursor-pointer select-none">
                        <Layers size={12} className="text-[#005A8C]" />
                        Show Existing Sites
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-6 border-t border-gray-100 flex items-center justify-between shrink-0">
              {!isFormValid ? (
                <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle size={14} /> 
                  Provide a name and map location.
                </span>
              ) : (
                <span /> 
              )}
              
              <button 
                type="submit" 
                disabled={!isFormValid}
                className="px-8 py-3 bg-[#009B9E] text-white text-sm font-black tracking-wide rounded-xl hover:bg-[#007a7d] transition-colors shadow-lg shadow-[#009B9E]/20 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
              >
                DEPLOY NEW SITE
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}