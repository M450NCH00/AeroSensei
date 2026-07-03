// src/components/Sidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Bot, Map, Leaf, TrendingUp, Settings,
  LogOut, Building, Cpu, Gavel, Mail, Database, ChevronLeft, ChevronRight
} from "lucide-react";
import axiosInstance from "@/app/api/axiosInstance";
import { useAuth } from "@/app/context/AuthContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { hasRole } = useAuth();
  const isGov = hasRole("GOVERNMENT") || hasRole("ADMIN");
  const isCompany = hasRole("COMPANY");

  const [isCollapsed, setIsCollapsed] = useState(false);

  const navLinks = [
    { name: "Overview Map", href: "/dashboard", icon: LayoutDashboard, hoverAnim: "group-hover:scale-110" },
    { name: "AI Assistant", href: "/dashboard/aiassistant", icon: Bot, hoverAnim: "group-hover:animate-bounce" },
    { name: "Company Sites", href: "/dashboard/sites", icon: Map, hoverAnim: "group-hover:-translate-y-1" },
    { name: "Register Site", href: "/dashboard/register-site", icon: Building, hoverAnim: "group-hover:-translate-y-1" },
    { name: "Register Sensor", href: "/dashboard/register-sensor", icon: Cpu, hoverAnim: "group-hover:rotate-90 duration-500" },
    ...(isGov || isCompany
      ? [{ name: isGov ? "Fines" : "My Fines", href: "/dashboard/fines", icon: Gavel, hoverAnim: "group-hover:-rotate-12 group-hover:-translate-y-0.5" }]
      : []),
    ...(isGov
      ? [{ name: "Ministry Alerts", href: "/dashboard/ministry-alerts", icon: Mail, hoverAnim: "group-hover:-translate-y-0.5" },
         { name: "Historical Data", href: "/dashboard/historical-data", icon: Database, hoverAnim: "group-hover:-translate-y-0.5" }]
      : []),
    { name: "Carbon Market", href: "/dashboard/carbon", icon: Leaf, hoverAnim: "group-hover:rotate-12 group-hover:text-emerald-500" },
    { name: "Carbon Credit", href: "/dashboard/carbon-credit", icon: TrendingUp, hoverAnim: "group-hover:-translate-y-1 group-hover:translate-x-1" },
    { name: "Settings", href: "/dashboard/settings", icon: Settings, hoverAnim: "group-hover:rotate-180 duration-700" },
  ];

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault(); 
    try {
      await axiosInstance.post("/auth/logout");
      window.location.href = "/login";
    } catch (error) {
      console.error("Failed to logout cleanly", error);
      window.location.href = "/login";
    }
  };

  return (
    <aside className={`relative z-20 flex flex-col hidden md:flex h-[100dvh] shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isCollapsed ? "w-20" : "w-64"}`}>
      
      <div className="absolute inset-0 bg-white/70 backdrop-blur-2xl border-r border-white/60 overflow-hidden z-0">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-[#009B9E]/20 rounded-full mix-blend-multiply opacity-60 animate-blob-shift" />
        <div className="absolute top-[40%] -right-20 w-48 h-48 bg-[#005A8C]/15 rounded-full mix-blend-multiply opacity-50 animate-blob-shift animation-delay-2000" />
      </div>

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-5 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-5 h-24 bg-white/60 backdrop-blur-3xl border border-l-0 border-white/80 shadow-[4px_0_20px_rgba(0,0,0,0.05)] rounded-r-2xl hover:bg-white/90 hover:shadow-[4px_0_20px_rgba(0,155,158,0.15)] text-[#005A8C] transition-all duration-300 cursor-pointer group"
      >
        <div className="transition-transform duration-300 scale-y-150 group-hover:scale-y-[2.5] group-hover:scale-x-125 group-hover:text-[#009B9E]">
          {isCollapsed ? <ChevronRight size={14} strokeWidth={4} /> : <ChevronLeft size={14} strokeWidth={4} />}
        </div>
      </button>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        <div className={`shrink-0 h-20 flex items-center border-b border-gray-100/50 relative overflow-hidden transition-all duration-500 ${isCollapsed ? "justify-center px-0" : "px-8"}`}>
          <div className="absolute left-4 top-4 w-12 h-12 bg-[#009B9E]/20 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10 hover:scale-105 transition-transform duration-300 cursor-default">
            <div className="relative w-8 h-8 drop-shadow-md shrink-0">
              <Image 
                src="/aerosense-logo-clear.png" 
                alt="Logo" 
                fill 
                sizes="32px"
                className="object-contain"
              />
            </div>
            
            <span className={`font-black text-xl tracking-tight text-[#005A8C] drop-shadow-sm whitespace-nowrap transition-all duration-500 ${isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100 block"}`}>
              Aero<span className="text-[#009B9E]">Sense</span>
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-3 py-4">
          <nav className={`flex flex-col ${isCollapsed ? "items-center space-y-2" : "space-y-1.5"}`}>
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              
              return (
                <Link 
                  key={link.name}
                  href={link.href} 
                  title={isCollapsed ? link.name : ""}
                  className={`group flex items-center relative transition-all duration-300 shrink-0 ${
                    isCollapsed 
                      ? "justify-center w-12 h-12 rounded-2xl" 
                      : "gap-3 px-4 py-3 w-full rounded-xl"
                  } ${
                    isActive 
                      // FANCY UPGRADE: Solid Fill, White text, and the "Blurred Bleed" border
                      ? "font-black bg-[#005A8C] text-white shadow-[0_0_20px_rgba(0,90,140,0.3)] ring-[6px] ring-[#005A8C]/10" 
                      : "font-bold text-gray-500 hover:text-[#005A8C] hover:bg-white/60 hover:shadow-sm hover:translate-x-1"
                  }`}
                >
                  {/* Cleaned out the old gradient background and border lines entirely! */}
                  <div className="relative z-10 flex items-center justify-center shrink-0">
                    <link.icon 
                      size={20} 
                      className={`transition-all ${link.hoverAnim} ${isActive ? "text-white" : "opacity-70 group-hover:opacity-100"}`} 
                    />
                  </div>
                  
                  {!isCollapsed && (
                    <span className="relative z-10 tracking-wide whitespace-nowrap text-inherit">{link.name}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className={`shrink-0 transition-all duration-500 ${isCollapsed ? "p-3 pb-6" : "p-5"}`}>
          <button 
            onClick={handleLogout}
            title={isCollapsed ? "Sign Out" : ""}
            className={`flex items-center bg-white/40 backdrop-blur-md border border-white/60 shadow-sm font-bold text-gray-600 hover:bg-red-50/90 hover:text-red-600 hover:border-red-200 hover:shadow-[0_8px_20px_rgba(239,68,68,0.15)] hover:-translate-y-1 active:translate-y-0 active:scale-95 transition-all duration-300 group cursor-pointer ${
              isCollapsed 
                ? "justify-center p-0 w-12 h-12 rounded-2xl mx-auto" 
                : "justify-between w-full p-3 rounded-2xl"
            }`}
          >
            {isCollapsed ? (
              <LogOut size={18} className="opacity-60 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110" />
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-[#005A8C] font-black text-xs group-hover:border-red-200 group-hover:text-red-600 transition-colors shrink-0">
                    U
                  </div>
                  <span className="tracking-wide text-sm whitespace-nowrap">Sign Out</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center group-hover:bg-red-100 transition-colors shrink-0">
                  <LogOut size={14} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300" />
                </div>
              </>
            )}
          </button>
        </div>

      </div>
    </aside>
  );
}