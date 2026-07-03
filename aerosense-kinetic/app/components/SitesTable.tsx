// src/components/SitesTable.tsx
import { Search, ArrowUpDown, ChevronRight, RefreshCw } from "lucide-react";
import RollingNumber from "./RollingNumber"; // 1. Import the RollingNumber component

export interface SiteData {
  id: string; 
  siteId: number;
  name: string;
  company: string;
  latitude: number;
  longitude: number;
  avgPm25: number | null;
  avgPm10: number | null;
  maxPm25: number | null;
  maxPm10: number | null;
  breachType: "NONE" | "PM2_5" | "PM10" | "MULTIPLE";
  state: "SAFE" | "WARNING" | "BREACHED";
  lastUpdated: string;
}

export type SortKey = "state" | "name" | "avgPm25" | "avgPm10";

interface SitesTableProps {
  data: SiteData[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  onSortToggle: (key: SortKey) => void;
  isLoading: boolean;
  onRefresh: () => void;
  timeAgo: string;
  onViewDetails: (site: SiteData) => void;
}

export default function SitesTable({
  data,
  searchTerm,
  onSearchChange,
  sortKey,
  sortDirection,
  onSortToggle,
  isLoading,
  onRefresh,
  timeAgo,
  onViewDetails,
}: SitesTableProps) {
  
  const renderSortIcon = (key: SortKey) => (
    <ArrowUpDown 
      size={14} 
      className={`ml-1 transition-colors ${sortKey === key ? "text-[#005A8C]" : "text-gray-400 group-hover:text-gray-600"}`} 
    />
  );

  const formatBreachType = (type: string) => {
    if (type === "PM2_5") return "PM2.5";
    if (type === "MULTIPLE") return "PM2.5 & PM10";
    return type;
  };

  return (
    // FANCY UPGRADE: Removed solid white bg to inherit parent glass. Added smooth transitions.
    <div className="flex flex-col h-full w-full">
      
      {/* HEADER SECTION */}
      <div className="p-6 border-b border-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 tracking-tight">Active Sensor Directory</h2>
          
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm font-medium text-gray-500">Managing {data.length} telemetry nodes</p>
            <span className="text-gray-300 text-xs">•</span>
            <button 
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-[#005A8C] transition-colors disabled:opacity-50 cursor-pointer"
              title="Force refresh table data"
            >
              {timeAgo}
              <RefreshCw size={12} className={isLoading ? "animate-spin text-[#005A8C]" : ""} />
            </button>
          </div>
        </div>
        
        <div className="relative w-full sm:w-72">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#005A8C]/50" />
          <input
            type="text"
            placeholder="Search sites or company..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            // FANCY UPGRADE: Floating pill input with deep focus rings
            className="w-full pl-11 pr-4 py-3 bg-white/40 backdrop-blur-md border border-white/60 shadow-[0_4px_15px_rgba(0,0,0,0.02)] rounded-2xl text-sm font-bold text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#009B9E]/50 focus:bg-white/80 transition-all duration-300"
          />
        </div>
      </div>

      {/* TABLE SECTION */}
      {/* FANCY UPGRADE: Invisible hover-to-reveal scrollbars */}
      <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400/60">
        <table className="w-full text-left border-collapse">
          {/* FANCY UPGRADE: Frosted glass sticky header */}
          <thead className="sticky top-0 bg-white/50 backdrop-blur-xl border-b border-white/60 z-10 shadow-sm">
            <tr>
              <th 
                className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase cursor-pointer group select-none transition-colors hover:bg-white/40"
                onClick={() => onSortToggle("state")}
              >
                <div className="flex items-center">State {renderSortIcon("state")}</div>
              </th>
              
              <th 
                className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase cursor-pointer group select-none transition-colors hover:bg-white/40"
                onClick={() => onSortToggle("name")}
              >
                <div className="flex items-center">Location & Company {renderSortIcon("name")}</div>
              </th>
              <th 
                className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase cursor-pointer group select-none transition-colors hover:bg-white/40"
                onClick={() => onSortToggle("avgPm25")}
              >
                <div className="flex items-center">PM2.5 (Avg / Peak) {renderSortIcon("avgPm25")}</div>
              </th>
              <th 
                className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase cursor-pointer group select-none transition-colors hover:bg-white/40"
                onClick={() => onSortToggle("avgPm10")}
              >
                <div className="flex items-center">PM10 (Avg / Peak) {renderSortIcon("avgPm10")}</div>
              </th>
              <th className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase">Last Sync</th>
              <th className="py-4 px-6 text-right"></th>
            </tr>
          </thead>
          
          {/* FANCY UPGRADE: Subtle translucent dividers */}
          <tbody className="divide-y divide-white/40">
            {isLoading && data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-sm font-bold text-gray-400">
                  <div className="flex items-center justify-center gap-2 animate-pulse">
                    <div className="w-4 h-4 border-2 border-[#005A8C] border-t-transparent rounded-full animate-spin" />
                    Syncing Telemetry...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-sm font-black tracking-widest uppercase text-gray-400 opacity-70">
                  No sensor nodes found matching criteria.
                </td>
              </tr>
            ) : (
              data.map((site) => (
                <tr 
                  key={site.id} 
                  onClick={() => onViewDetails(site)}
                  // FANCY UPGRADE: Rows highlight and lift slightly on hover
                  className="hover:bg-white/50 transition-all duration-300 group cursor-pointer hover:shadow-[0_4px_20px_rgba(0,90,140,0.03)] relative"
                >
                  <td className="py-4 px-6 align-top pt-5">
                    <div className="flex flex-col items-start gap-1">
                      {/* FANCY UPGRADE: Glowing Status Badges */}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm transition-all
                        ${site.state === "BREACHED" ? "bg-red-500/10 border-red-500/30 text-red-600 shadow-[0_0_10px_rgba(239,68,68,0.2)]" : ""}
                        ${site.state === "WARNING" ? "bg-amber-500/10 border-amber-500/30 text-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.2)]" : ""}
                        ${site.state === "SAFE" ? "bg-[#009B9E]/10 border-[#009B9E]/30 text-[#007B7E] shadow-[0_0_10px_rgba(0,155,158,0.2)]" : ""}
                      `}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          site.state === "BREACHED" ? "bg-red-500 animate-pulse" : 
                          site.state === "WARNING" ? "bg-amber-500" : "bg-[#009B9E]"
                        }`} />
                        {site.state.toLowerCase()}
                      </span>
                      
                      {site.state !== "SAFE" && site.breachType !== "NONE" && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded mt-1 whitespace-nowrap border ${
                           site.state === "BREACHED" ? "bg-red-100/50 border-red-200 text-red-600" : "bg-amber-100/50 border-amber-200 text-amber-600"
                        }`}>
                          {formatBreachType(site.breachType)}
                        </span>
                      )}
                    </div>
                  </td>
                  
                  <td className="py-4 px-6 align-top">
                    <p className="font-black text-gray-800 tracking-tight group-hover:text-[#005A8C] transition-colors">{site.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5 bg-white/50 px-1.5 py-0.5 rounded border border-white/60 w-max">
                      {site.company || "Unknown"}
                    </p>
                  </td>
                  
                  <td className="py-4 px-6 align-top">
                    <div className="flex flex-col">
                      <span className="font-black text-gray-800 text-base">
                        {/* 2. Replaced static text with RollingNumber */}
                        <RollingNumber value={site.avgPm25} decimals={1} />
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 mt-0.5 flex items-center gap-1">
                        Peak: <span className="text-gray-600"><RollingNumber value={site.maxPm25} decimals={1} /></span>
                      </span>
                    </div>
                  </td>
                  
                  <td className="py-4 px-6 align-top">
                    <div className="flex flex-col">
                      <span className="font-black text-gray-800 text-base">
                        {/* 2. Replaced static text with RollingNumber */}
                        <RollingNumber value={site.avgPm10} decimals={1} />
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 mt-0.5 flex items-center gap-1">
                        Peak: <span className="text-gray-600"><RollingNumber value={site.maxPm10} decimals={1} /></span>
                      </span>
                    </div>
                  </td>
                  
                  <td className="py-4 px-6 align-top pt-5 text-[11px] font-bold text-gray-400 tracking-wider uppercase">
                    {site.lastUpdated}
                  </td>
                  
                  <td className="py-4 px-6 text-right align-top pt-4">
                    <div className="p-2 text-gray-300 group-hover:text-[#005A8C] group-hover:bg-[#005A8C]/10 rounded-xl transition-all duration-300 inline-flex group-hover:translate-x-1 group-hover:shadow-sm cursor-pointer">
                      <ChevronRight size={18} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}