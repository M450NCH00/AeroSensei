// src/components/SitesTable.tsx
import { Search, ArrowUpDown, ChevronRight, RefreshCw } from "lucide-react";

export interface SiteData {
  id: string; // React still needs a unique key
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

// Updated sort key: replaced 'status' with 'state'
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
      className={`ml-1 transition-colors ${sortKey === key ? "text-[#005A8C]" : "text-gray-300 group-hover:text-gray-500"}`} 
    />
  );

  const formatBreachType = (type: string) => {
    if (type === "PM2_5") return "PM2.5";
    if (type === "MULTIPLE") return "PM2.5 & PM10";
    return type;
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-200/60 overflow-hidden flex flex-col h-full">
      
      {/* HEADER SECTION */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 tracking-tight">Active Sensor Directory</h2>
          
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm font-medium text-gray-500">Managing {data.length} telemetry nodes</p>
            <span className="text-gray-300 text-xs">•</span>
            <button 
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-[#005A8C] transition-colors disabled:opacity-50"
              title="Force refresh table data"
            >
              {timeAgo}
              <RefreshCw size={12} className={isLoading ? "animate-spin text-[#005A8C]" : ""} />
            </button>
          </div>
        </div>
        
        <div className="relative w-full sm:w-72">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            // Removed 'ID' from placeholder text
            placeholder="Search sites or company..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#009B9E]/50 focus:border-[#009B9E] transition-all"
          />
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10 backdrop-blur-md bg-opacity-90">
            <tr>
              {/* Updated column header to 'State' */}
              <th 
                className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase cursor-pointer group select-none"
                onClick={() => onSortToggle("state")}
              >
                <div className="flex items-center">State {renderSortIcon("state")}</div>
              </th>
              
              <th 
                className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase cursor-pointer group select-none"
                onClick={() => onSortToggle("name")}
              >
                <div className="flex items-center">Location & Company {renderSortIcon("name")}</div>
              </th>
              <th 
                className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase cursor-pointer group select-none"
                onClick={() => onSortToggle("avgPm25")}
              >
                <div className="flex items-center">PM2.5 (Avg / Peak) {renderSortIcon("avgPm25")}</div>
              </th>
              <th 
                className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase cursor-pointer group select-none"
                onClick={() => onSortToggle("avgPm10")}
              >
                <div className="flex items-center">PM10 (Avg / Peak) {renderSortIcon("avgPm10")}</div>
              </th>
              <th className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase">Last Sync</th>
              <th className="py-4 px-6 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm font-bold text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#005A8C] border-t-transparent rounded-full animate-spin" />
                    Syncing Telemetry...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm font-bold text-gray-400">
                  No sensor nodes found matching your criteria.
                </td>
              </tr>
            ) : (
              data.map((site) => (
                <tr 
                  key={site.id} 
                  className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                >
                  <td className="py-4 px-6 align-top pt-5">
                    <div className="flex flex-col items-start gap-1">
                      {/* State Badge Rendering */}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider
                        ${site.state === "BREACHED" ? "bg-red-100 text-red-800" : ""}
                        ${site.state === "WARNING" ? "bg-yellow-100 text-yellow-800" : ""}
                        ${site.state === "SAFE" ? "bg-green-100 text-green-800" : ""}
                      `}>
                        {site.state.toLowerCase()}
                      </span>
                      
                      {/* Existing breach type text below the badge */}
                      {site.state !== "SAFE" && site.breachType !== "NONE" && (
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded mt-1 whitespace-nowrap ${
                           site.state === "BREACHED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {formatBreachType(site.breachType)}
                        </span>
                      )}
                    </div>
                  </td>
                  
                  <td className="py-4 px-6 align-top">
                    <p className="font-bold text-gray-800">{site.name}</p>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                      {site.company || "Unknown"}
                    </p>
                    {/* ID display has been removed from here */}
                  </td>
                  
                  <td className="py-4 px-6 align-top">
                    <div className="flex flex-col">
                      <span className="font-black text-gray-800">
                        {site.avgPm25 != null ? site.avgPm25 : "—"}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 mt-0.5">
                        Peak: {site.maxPm25 != null ? site.maxPm25 : "—"}
                      </span>
                    </div>
                  </td>
                  
                  <td className="py-4 px-6 align-top">
                    <div className="flex flex-col">
                      <span className="font-black text-gray-800">
                        {site.avgPm10 != null ? site.avgPm10 : "—"}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 mt-0.5">
                        Peak: {site.maxPm10 != null ? site.maxPm10 : "—"}
                      </span>
                    </div>
                  </td>
                  
                  <td className="py-4 px-6 align-top pt-5 text-sm font-semibold text-gray-500">
                    {site.lastUpdated}
                  </td>
                  
                  <td className="py-4 px-6 text-right align-top pt-4">
                    <button 
                        onClick={() => onViewDetails(site)}
                        aria-label={`View details for ${site.name}`}
                        className="p-2 text-gray-300 group-hover:text-[#005A8C] group-hover:bg-[#005A8C]/10 rounded-lg transition-all inline-flex"
                    >
                      <ChevronRight size={18} />
                    </button>
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