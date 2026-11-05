// src/components/MacroDigest.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Layers, Loader2, RefreshCw } from "lucide-react";
import axiosInstance from "../api/axiosInstance";
import RollingNumber from "./RollingNumber"; // 1. Import the RollingNumber component

interface DigestData {
  totalSites: number;
  activeWarnings: number;
  activeBreaches: number;
}

export default function MacroDigest() {
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>("Syncing...");

  const fetchDigest = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get<DigestData>("/sensors/digest");
      setDigest(response.data);
      setLastSync(new Date()); 
    } catch (error) {
      console.error("Failed to fetch macro digest:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDigest();
    const fetchInterval = setInterval(fetchDigest, 300000);
    return () => clearInterval(fetchInterval);
  }, [fetchDigest]);

  useEffect(() => {
    if (!lastSync) return;
    
    const updateText = () => {
      const diffInMinutes = Math.floor((new Date().getTime() - lastSync.getTime()) / 60000);
      if (diffInMinutes === 0) setTimeAgo("Just now");
      else setTimeAgo(`${diffInMinutes}m ago`);
    };
    
    updateText(); 
    const textInterval = setInterval(updateText, 10000);
    return () => clearInterval(textInterval);
  }, [lastSync]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-black text-base text-gray-800 flex items-center gap-2 tracking-tight">
          <Layers size={18} className="text-[#005A8C]" />
          Macro Station Digest
        </h2>
        
        <button 
          onClick={fetchDigest}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-[#005A8C] transition-colors disabled:opacity-50"
          title="Force refresh data"
        >
          {timeAgo}
          <RefreshCw size={12} className={isLoading ? "animate-spin text-[#005A8C]" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 relative">
        
        {isLoading && !digest && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
            <Loader2 className="animate-spin text-[#005A8C]" size={20} />
          </div>
        )}

        <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Sites</p>
          <p className="text-xl font-black text-[#005A8C] mt-0.5">
            {/* 2. Replaced static text with RollingNumber */}
            <RollingNumber value={digest?.totalSites || 0} />
          </p>
        </div>
        <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl text-center">
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Breaches</p>
          <p className="text-xl font-black text-red-600 mt-0.5">
            {/* 2. Replaced static text with RollingNumber */}
            <RollingNumber value={digest?.activeBreaches || 0} />
          </p>
        </div>
        <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-center">
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Warnings</p>
          <p className="text-xl font-black text-[#F28C28] mt-0.5">
            {/* 2. Replaced static text with RollingNumber */}
            <RollingNumber value={digest?.activeWarnings || 0} />
          </p>
        </div>
        
      </div>
    </div>
  );
}