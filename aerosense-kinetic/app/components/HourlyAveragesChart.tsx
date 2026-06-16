// src/components/HourlyAveragesChart.tsx
import { TrendingUp } from "lucide-react";

export default function HourlyAveragesChart() {
  return (
    <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[#009B9E]" />
          <span className="font-bold text-sm text-gray-800">Hourly Averages (µg/m³)</span>
        </div>
        <span className="text-[10px] font-black bg-white px-2 py-0.5 rounded-md text-gray-400 border border-gray-100 shadow-2xs">24h FEED</span>
      </div>

      <div className="w-full h-24 relative mt-2">
        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
          <line x1="0" y1="10" x2="100" y2="10" stroke="#E2E8F0" strokeWidth="0.2" strokeDasharray="1,1" />
          <line x1="0" y1="20" x2="100" y2="20" stroke="#E2E8F0" strokeWidth="0.2" strokeDasharray="1,1" />
          
          <path d="M 0 25 Q 20 18, 40 22 T 80 12 T 100 15 L 100 30 L 0 30 Z" fill="url(#tealGlow)" opacity="0.15" />
          <path d="M 0 25 Q 20 18, 40 22 T 80 12 T 100 15" fill="none" stroke="#009B9E" strokeWidth="1" strokeLinecap="round" />
          <path d="M 0 18 Q 25 10, 50 25 T 100 8" fill="none" stroke="#005A8C" strokeWidth="1.2" strokeLinecap="round" />
          
          <circle cx="100" cy="8" r="1.5" fill="#005A8C" />
          <circle cx="100" cy="8" r="3" fill="#005A8C" opacity="0.3" className="animate-ping" />

          <defs>
            <linearGradient id="tealGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#009B9E" />
              <stop offset="100%" stopColor="#009B9E" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex gap-4 mt-3 text-[11px] font-bold text-gray-500 justify-center">
        <span className="flex items-center gap-1.5"><span className="w-2 h-0.5 bg-[#005A8C] rounded-full" /> PM2.5 Avg</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-0.5 bg-[#009B9E] rounded-full" /> PM10 Avg</span>
      </div>
    </div>
  );
}