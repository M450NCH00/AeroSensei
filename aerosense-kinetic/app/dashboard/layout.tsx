// src/app/dashboard/layout.tsx
import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, Bot, Map, Settings, LogOut } from "lucide-react";

export default function DashboardLayout({
  children, // This is the required prop Next.js was looking for!
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-[#1D1D1F] overflow-hidden">
      
      {/* --- PERSISTENT SIDEBAR --- */}
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
                  className="object-contain"
                />
              </div>
              <span className="font-black text-xl tracking-tight text-[#005A8C]">
                Aero<span className="text-[#009B9E]">Sense</span>
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-2 mt-4">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold bg-[#009B9E]/10 text-[#009B9E] rounded-xl transition-all"
            >
              <LayoutDashboard size={18} />
              Overview Map
            </Link>

            <Link 
              href="/dashboard/aiassistant" 
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 hover:text-[#005A8C] rounded-xl transition-all"
            >
              <Bot size={18} />
              AI Assistant
            </Link>

            <Link 
              href="/dashboard/sites" 
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 hover:text-[#005A8C] rounded-xl transition-all"
            >
              <Map size={18} />
              Sensor Sites
            </Link>

            <Link 
              href="/dashboard/settings" 
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 hover:text-[#005A8C] rounded-xl transition-all"
            >
              <Settings size={18} />
              Settings
            </Link>
          </nav>
        </div>

        {/* User Profile / Logout Section */}
        <div className="p-4 border-t border-gray-100">
          <Link 
            href="/login" 
            className="flex items-center justify-between px-4 py-3 text-sm font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[#005A8C] font-black text-xs">
                JD
              </div>
              <span>Sign Out</span>
            </div>
            <LogOut size={16} className="opacity-50 group-hover:opacity-100" />
          </Link>
        </div>
      </aside>

      {/* --- DYNAMIC MAIN CONTENT --- */}
      {/* This is the "hole" where Next.js injects page.tsx, aiassistant/page.tsx, etc. */}
      <main className="flex-1 overflow-y-auto relative">
        {children}
      </main>

    </div>
  );
}