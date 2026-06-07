// src/app/dashboard/page.tsx
"use client";

import dynamic from "next/dynamic";
import { Activity, Wind, AlertTriangle } from "lucide-react";

// THIS IS THE SECRET SAUCE: It tells Next.js to NEVER render this on the server
const DynamicMap = dynamic(() => import("../components/VietnamMap"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-3xl animate-pulse">
      <p className="text-gray-400 font-bold tracking-widest">INITIALIZING SENSORS...</p>
    </div>
  )
});

export default function DashboardHome() {
  return (
    <div className="p-8 h-screen flex flex-col gap-8 bg-[#F8FAFC]">
      
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-[#005A8C]/10 text-[#005A8C] rounded-xl"><Activity size={24} /></div>
          <div><p className="text-sm text-gray-500 font-bold">Active Sensors</p><p className="text-2xl font-black">24 / 24</p></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-[#009B9E]/10 text-[#009B9E] rounded-xl"><Wind size={24} /></div>
          <div><p className="text-sm text-gray-500 font-bold">National Avg AQI</p><p className="text-2xl font-black">42 (Good)</p></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-[#F28C28]/10 text-[#F28C28] rounded-xl"><AlertTriangle size={24} /></div>
          <div><p className="text-sm text-gray-500 font-bold">Active Alerts</p><p className="text-2xl font-black">1 Zone</p></div>
        </div>
      </div>

      {/* The Map Section */}
      <div className="flex-grow flex gap-8 min-h-[500px]">
        {/* The Actual Map takes up the majority of the space */}
        <div className="flex-grow relative rounded-3xl shadow-sm border border-gray-100 bg-white p-2">
          <DynamicMap />
        </div>
        
        {/* A sleek sidebar list of the sensors next to the map */}
        <div className="w-80 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
          <h2 className="font-black text-xl text-[#005A8C]">Live Feed</h2>
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
            <p className="font-bold text-sm">Hanoi Central</p>
            <p className="text-[#009B9E] text-xs font-bold mt-1">● Online</p>
          </div>
          <div className="p-4 rounded-xl bg-[#F28C28]/10 border border-[#F28C28]/20">
            <p className="font-bold text-sm text-[#d9771e]">Da Nang Industrial</p>
            <p className="text-[#F28C28] text-xs font-bold mt-1">● Warning: High PM2.5</p>
          </div>
        </div>
      </div>

    </div>
  );
}