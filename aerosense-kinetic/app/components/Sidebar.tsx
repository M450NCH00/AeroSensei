// src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
// 1. Imported the Building and Cpu icons here
import { LayoutDashboard, Bot, Map, Leaf, TrendingUp, Settings, LogOut, Building, Cpu, Gavel } from "lucide-react";
import axiosInstance from "../api/axiosInstance";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const pathname = usePathname(); // This magic hook grabs the current URL path!
  const { hasRole } = useAuth();
  const isGov = hasRole("GOVERNMENT") || hasRole("ADMIN");

  // 2. Added the two new registration links
  const navLinks = [
    { name: "Overview Map", href: "/dashboard", icon: LayoutDashboard },
    { name: "AI Assistant", href: "/dashboard/aiassistant", icon: Bot },
    { name: "Company Sites", href: "/dashboard/sites", icon: Map },
    { name: "Register Site", href: "/dashboard/register-site", icon: Building },
    { name: "Register Sensor", href: "/dashboard/register-sensor", icon: Cpu },
    // Enforcement is a regulator-only surface.
    ...(isGov ? [{ name: "Fines", href: "/dashboard/fines", icon: Gavel }] : []),
    { name: "Carbon Market", href: "/dashboard/carbon", icon: Leaf },
    { name: "Carbon Credit", href: "/dashboard/carbon-credit", icon: TrendingUp },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
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
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between hidden md:flex shadow-sm z-20">
      
      <div>
        {/* Logo Section */}
        <div className="h-20 flex items-center px-8 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8">
              <Image 
                src="/aerosense-logo-clear.png" 
                alt="Logo" 
                fill 
                sizes="32px"
                className="object-contain"
              />
            </div>
            <span className="font-black text-xl tracking-tight text-[#005A8C]">
              Aero<span className="text-[#009B9E]">Sense</span>
            </span>
          </div>
        </div>

        {/* Dynamic Navigation Links */}
        <nav className="p-4 space-y-2 mt-4">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            
            return (
              <Link 
                key={link.name}
                href={link.href} 
                className={`flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${
                  isActive 
                    ? "bg-[#009B9E]/10 text-[#009B9E]" // Active state
                    : "text-gray-500 hover:bg-gray-50 hover:text-[#005A8C]" // Inactive state
                }`}
              >
                <link.icon size={18} />
                {link.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Profile / Logout Section */}
      <div className="p-4 border-t border-gray-100">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[#005A8C] font-black text-xs">
              U
            </div>
            <span>Sign Out</span>
          </div>
          <LogOut size={16} className="opacity-50 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    </aside>
  );
}