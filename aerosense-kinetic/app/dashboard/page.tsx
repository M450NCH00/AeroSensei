// src/app/dashboard/page.tsx
"use client";

import dynamic from "next/dynamic";

import DashboardHeader from "../components/DashboardHeader";
import MacroDigest from "../components/MacroDigest";
import CriticalNodesList from "../components/CriticalNodesList";

const DynamicMap = dynamic(() => import("../components/AeroMap"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-white/40 backdrop-blur-md rounded-[1.5rem] animate-pulse">
      <p className="text-[#005A8C] font-black tracking-widest text-sm">INITIALIZING MAP RADAR...</p>
    </div>
  )
});

export default function DashboardHome() {
  return (
    <div className="p-8 min-h-screen bg-[#F1F5F9] flex flex-col gap-6 relative select-none overflow-hidden">
      
      {/* THE AMBIENT AURA BACKGROUND */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-[#009B9E]/30 rounded-full mix-blend-multiply opacity-60 animate-blob-shift" />
        <div className="absolute top-[20%] right-[-10%] w-[35rem] h-[35rem] bg-[#005A8C]/20 rounded-full mix-blend-multiply opacity-60 animate-blob-shift animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[45rem] h-[45rem] bg-[#FBBF24]/20 rounded-full mix-blend-multiply opacity-50 animate-blob-shift animation-delay-4000" />
      </div>

      <div className="relative z-10 flex flex-col gap-6 h-full">
        
        <DashboardHeader />

        <div className="w-full flex flex-col xl:flex-row gap-6 h-[calc(100vh-4rem)] min-h-[600px]">
          
          {/* Map View Canvas Workspace */}
          <div className="flex-1 relative rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 bg-white/70 backdrop-blur-2xl flex flex-col h-full overflow-hidden transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,90,140,0.08)] hover:bg-white/80">
            
            <div className="absolute top-6 left-6 z-10 bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/50 text-xs font-bold text-[#005A8C] flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#009B9E] animate-ping" />
              Live Geospatial Matrix
            </div>
            
            <div className="w-full h-full flex-1 rounded-[1.5rem] overflow-hidden border border-white/40">
              <DynamicMap />
            </div>
          </div>
          
          {/* UPGRADED: Analytics Insights Sidebar */}
          {/* Added custom webkit scrollbar styling directly via Tailwind arbitrary variants */}
          <aside className="w-full xl:w-96 shrink-0 bg-white/60 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 p-6 flex flex-col h-full overflow-y-auto transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,90,140,0.08)] hover:bg-white/70 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400/60">
            
            <div className="flex flex-col gap-5">
              <MacroDigest />
              
              {/* Premium Fading Divider */}
              <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-gray-200/80 to-transparent shrink-0" />
              
              <CriticalNodesList />
            </div>

          </aside>

        </div>
      </div>
    </div>
  );
}