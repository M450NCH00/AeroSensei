// src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Bot, Map, Leaf, TrendingUp, Settings, LogOut, Building, Cpu, Gavel } from "lucide-react";
import axiosInstance from "../api/axiosInstance";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { hasRole } = useAuth();
  const isGov = hasRole("GOVERNMENT") || hasRole("ADMIN");
  const isCompany = hasRole("COMPANY");

  // We add a specific animation class string to each link for custom hover physics!
  const navLinks = [
    { name: "Overview Map", href: "/dashboard", icon: LayoutDashboard, hoverAnim: "group-hover:scale-110" },
    { name: "AI Assistant", href: "/dashboard/aiassistant", icon: Bot, hoverAnim: "group-hover:animate-bounce" },
    { name: "Company Sites", href: "/dashboard/sites", icon: Map, hoverAnim: "group-hover:-translate-y-1" },
    { name: "Register Site", href: "/dashboard/register-site", icon: Building, hoverAnim: "group-hover:-translate-y-1" },
    { name: "Register Sensor", href: "/dashboard/register-sensor", icon: Cpu, hoverAnim: "group-hover:rotate-90 duration-500" },
    ...(isGov || isCompany
      ? [{ name: isGov ? "Fines" : "My Fines", href: "/dashboard/fines", icon: Gavel, hoverAnim: "group-hover:-rotate-12 group-hover:-translate-y-0.5" }]
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
    // UPGRADE 1: Glassmorphism base with subtle shadow blending
    <aside className="w-64 bg-white/70 backdrop-blur-2xl border-r border-white/60 flex flex-col justify-between hidden md:flex shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 transition-all duration-500">
      
      <div>
        {/* Logo Section */}
        <div className="h-20 flex items-center px-8 border-b border-gray-100/50 relative overflow-hidden">
          {/* Subtle logo glow behind the text */}
          <div className="absolute left-4 top-4 w-12 h-12 bg-[#009B9E]/20 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10 hover:scale-105 transition-transform duration-300 cursor-default">
            <div className="relative w-8 h-8 drop-shadow-md">
              <Image 
                src="/aerosense-logo-clear.png" 
                alt="Logo" 
                fill 
                sizes="32px"
                className="object-contain"
              />
            </div>
            <span className="font-black text-xl tracking-tight text-[#005A8C] drop-shadow-sm">
              Aero<span className="text-[#009B9E]">Sense</span>
            </span>
          </div>
        </div>

        {/* Dynamic Navigation Links */}
        <nav className="p-4 space-y-1.5 mt-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            
            return (
              <Link 
                key={link.name}
                href={link.href} 
                // UPGRADE 2: "group" enables children to react when the parent is hovered
                className={`group flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all duration-300 relative overflow-hidden ${
                  isActive 
                    ? "font-black text-[#005A8C] shadow-sm" // Active Text
                    : "font-bold text-gray-500 hover:text-[#005A8C] hover:bg-white/60 hover:shadow-sm hover:translate-x-1" // Inactive Text & Hover
                }`}
              >
                {/* UPGRADE 3: The "Liquid" Active Background */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-[#009B9E]/15 to-transparent z-0 border-l-4 border-[#009B9E]" />
                )}

                {/* UPGRADE 4: Kinetic Icons */}
                <div className="relative z-10 flex items-center justify-center">
                  <link.icon 
                    size={18} 
                    className={`transition-all ${link.hoverAnim} ${isActive ? "text-[#009B9E]" : "opacity-70 group-hover:opacity-100"}`} 
                  />
                </div>
                
                <span className="relative z-10 tracking-wide">{link.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Profile / Logout Section */}
      <div className="p-4 border-t border-gray-100/50 bg-gradient-to-t from-gray-50/50 to-transparent">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-gray-500 hover:bg-red-50/80 hover:text-red-600 hover:shadow-[0_0_15px_rgba(239,68,68,0.15)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 rounded-xl transition-all duration-300 group cursor-pointer border border-transparent hover:border-red-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-[#005A8C] font-black text-xs group-hover:border-red-200 group-hover:text-red-600 transition-colors">
              U
            </div>
            <span className="tracking-wide">Sign Out</span>
          </div>
          <LogOut size={16} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
        </button>
      </div>
      
    </aside>
  );
}