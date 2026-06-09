// src/components/CriticalNodesList.tsx
import { AlertTriangle } from "lucide-react";

const criticalSites = [
  { name: "Da Nang Industrial", p25: 156, p10: 98, trend: "up" },
  { name: "Ho Chi Minh Port Zone", p25: 112, p10: 145, trend: "up" },
  { name: "Hanoi Border Highway", p25: 94, p10: 88, trend: "stable" },
];

export default function CriticalNodesList() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2 tracking-tight">
        <AlertTriangle size={18} className="text-[#F28C28]" />
        Critical Danger Nodes
      </h2>
      <div className="space-y-3 overflow-y-auto flex-1 pr-1">
        {criticalSites.map((site, idx) => (
          <div key={idx} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-2xs flex flex-col gap-2 hover:border-gray-300 transition-colors">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm text-gray-800 truncate max-w-[180px]">{site.name}</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                site.p25 > 120 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
              }`}>
                {site.p25 > 120 ? "UNHEALTHY" : "MODERATE"}
              </span>
            </div>
            
            <div className="grid grid-cols-2 text-xs font-bold border-t border-gray-50 pt-2 mt-0.5">
              <div>
                <p className="text-[10px] font-semibold text-gray-400">PM2.5</p>
                <p className="text-sm font-black text-gray-700 mt-0.5">{site.p25} <span className="text-[10px] font-normal text-gray-400">µg</span></p>
              </div>
              <div className="border-l border-gray-100 pl-3">
                <p className="text-[10px] font-semibold text-gray-400">PM10</p>
                <p className="text-sm font-black text-gray-700 mt-0.5">{site.p10} <span className="text-[10px] font-normal text-gray-400">µg</span></p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}