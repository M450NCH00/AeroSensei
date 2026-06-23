// src/components/RegisterSensorManager.tsx
"use client";

import { useState, useEffect } from "react";
import { Building, MapPin, Plus, Cpu, CheckCircle2, AlertCircle } from "lucide-react";
import axiosInstance from "@/app/api/axiosInstance";
import RequirePermission from "../components/RequirePermission";
import SensorsTable, { SensorData } from "./SensorsTable";

interface Company { id: number; companyName: string; }
interface Site { id: number; siteName: string; }

export default function RegisterSensorManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [sensors, setSensors] = useState<SensorData[]>([]);
  
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("");
  const [selectedSiteId, setSelectedSiteId] = useState<number | "">("");
  
  const [newSensorId, setNewSensorId] = useState("");
  const [isLoadingSensors, setIsLoadingSensors] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // 1. Fetch Companies on mount
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await axiosInstance.get("/companies");
        if (Array.isArray(res)) setCompanies(res);
        else if (res.data && Array.isArray(res.data)) setCompanies(res.data);
        else if (res.data?.data && Array.isArray(res.data.data)) setCompanies(res.data.data);
      } catch (error) {
        console.error("Failed to fetch companies", error);
      }
    };
    fetchCompanies();
  }, []);

  // 2. Fetch Sites when Company changes
  useEffect(() => {
    setSelectedSiteId(""); 
    setSensors([]);
    if (!selectedCompanyId) {
      setSites([]);
      return;
    }
    const fetchSites = async () => {
      try {
        const res = await axiosInstance.get(`/companies/${selectedCompanyId}/sites`);
        if (Array.isArray(res)) setSites(res);
        else if (res.data && Array.isArray(res.data)) setSites(res.data);
        else if (res.data?.data && Array.isArray(res.data.data)) setSites(res.data.data);
      } catch (error) {
        console.error("Failed to fetch sites", error);
      }
    };
    fetchSites();
  }, [selectedCompanyId]);

  // 3. Fetch Sensors when Site changes
  const fetchSensorsForSite = async () => {
    if (!selectedSiteId) return;
    setIsLoadingSensors(true);
    try {
      const res = await axiosInstance.get(`/sensors/site/${selectedSiteId}/list`);
      if (Array.isArray(res)) setSensors(res);
      else if (res.data && Array.isArray(res.data)) setSensors(res.data);
      else if (res.data?.data && Array.isArray(res.data.data)) setSensors(res.data.data);
    } catch (error) {
      console.error("Failed to fetch sensors", error);
    } finally {
      setIsLoadingSensors(false);
    }
  };

  useEffect(() => {
    fetchSensorsForSite();
  }, [selectedSiteId]);

  // 4. Handle Add Sensor
  const handleAddSensor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSiteId || !newSensorId.trim()) return;

    try {
      await axiosInstance.post("/sensors/register", {
        sensorId: newSensorId.trim(),
        siteId: selectedSiteId
      });
      
      setStatusMsg({ text: `Sensor ${newSensorId} deployed successfully!`, type: "success" });
      setNewSensorId("");
      fetchSensorsForSite(); // Refresh the table
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (error) {
      setStatusMsg({ text: "Failed to register sensor. It may already exist.", type: "error" });
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // 5. Handle Delete Sensor
  const handleDeleteSensor = async (sensorId: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete sensor ${sensorId}?`)) return;
    
    try {
      await axiosInstance.delete(`/sensors/${sensorId}`);
      setStatusMsg({ text: `Sensor ${sensorId} removed.`, type: "success" });
      fetchSensorsForSite(); // Refresh the table
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (error) {
      setStatusMsg({ text: "Failed to delete sensor.", type: "error" });
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full">
      
      {/* LEFT COLUMN: Cascade Selectors */}
      <aside className="w-full xl:w-1/3 bg-white rounded-[2rem] shadow-sm border border-gray-200/60 p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 mb-6">
            <Cpu className="text-[#005A8C]" size={24} />
            Hardware Assignment
          </h2>
          
          <div className="space-y-5">
            {/* Company Dropdown */}
            <div className="space-y-2">
              <label htmlFor="company-select" className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Building size={14} /> 1. Select Organization
              </label>
              <select 
                id="company-select"
                value={selectedCompanyId} 
                onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : "")}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#009B9E]/50 focus:border-[#009B9E] transition-all cursor-pointer"
              >
                <option value="">-- Choose a Company --</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
            </div>

            {/* Site Dropdown */}
            <div className={`space-y-2 transition-opacity duration-300 ${!selectedCompanyId ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
              <label htmlFor="site-select" className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={14} /> 2. Select Location Site
              </label>
              <select 
                id="site-select"
                value={selectedSiteId} 
                onChange={(e) => setSelectedSiteId(e.target.value ? Number(e.target.value) : "")}
                disabled={!selectedCompanyId}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#009B9E]/50 focus:border-[#009B9E] transition-all cursor-pointer"
              >
                <option value="">-- Choose a Site --</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
              </select>
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT COLUMN: Table & Add Form */}
      <div className="w-full xl:w-2/3 bg-white rounded-[2rem] shadow-sm border border-gray-200/60 p-8 flex flex-col min-h-[500px]">
        
        {!selectedSiteId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <Cpu size={48} className="text-gray-200 mb-4" />
            <h3 className="text-lg font-bold text-gray-400">Select an assignment target</h3>
            <p className="text-sm text-gray-400 mt-2">Choose an organization and site from the sidebar to manage their hardware nodes.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-6">
            
            {/* Header & Inline Add Form */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-2xl font-black text-gray-800 tracking-tight">Active Hardware Nodes</h2>
                <p className="text-sm font-semibold text-gray-500 mt-1">Managing {sensors.length} nodes for this site.</p>
              </div>

              {/* Security Check: Only render the Add form if they have permission */}
              <RequirePermission permission="ADD_SENSORS">
                <form onSubmit={handleAddSensor} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Enter Hardware ID..."
                    value={newSensorId}
                    onChange={(e) => setNewSensorId(e.target.value)}
                    className="w-full sm:w-48 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#009B9E]/50 focus:border-[#009B9E] transition-all"
                  />
                  <button 
                    type="submit" 
                    disabled={!newSensorId.trim()}
                    className="px-4 py-2.5 bg-[#005A8C] text-white text-sm font-bold rounded-xl hover:bg-[#00466e] transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0"
                  >
                    <Plus size={16} /> Deploy
                  </button>
                </form>
              </RequirePermission>
            </div>

            {/* Status Messages */}
            {statusMsg && (
              <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold shrink-0 ${statusMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {statusMsg.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {statusMsg.text}
              </div>
            )}

            {/* The Table Component */}
            <SensorsTable 
              sensors={sensors} 
              isLoading={isLoadingSensors} 
              onDelete={handleDeleteSensor} 
            />

          </div>
        )}
      </div>
    </div>
  );
}