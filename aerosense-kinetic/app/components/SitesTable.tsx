// src/components/SitesTable.tsx
import { Search, ArrowUpDown, ChevronRight } from "lucide-react";

export interface SiteData {
  id: string;
  name: string;
  pm25: number;
  pm10: number;
  lastUpdated: string;
  status: "good" | "warning" | "danger" | "offline";
}

export type SortKey = "name" | "pm25" | "pm10";

interface SitesTableProps {
  data: SiteData[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  onSortToggle: (key: SortKey) => void;
  isLoading: boolean;
}

export default function SitesTable({
  data,
  searchTerm,
  onSearchChange,
  sortKey,
  sortDirection,
  onSortToggle,
  isLoading,
}: SitesTableProps) {
  
  // Helper to render the sort icon based on active state
  const renderSortIcon = (key: SortKey) => (
    <ArrowUpDown 
      size={14} 
      className={`ml-1 transition-colors ${sortKey === key ? "text-[#005A8C]" : "text-gray-300 group-hover:text-gray-500"}`} 
    />
  );

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-200/60 overflow-hidden flex flex-col h-full">
      
      {/* Header & Search Bar */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 tracking-tight">Active Sensor Directory</h2>
          <p className="text-sm font-medium text-gray-500">Managing {data.length} telemetry nodes</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search sites by name or ID..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#009B9E]/50 focus:border-[#009B9E] transition-all"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10 backdrop-blur-md bg-opacity-90">
            <tr>
              <th className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase">Status</th>
              <th 
                className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase cursor-pointer group select-none"
                onClick={() => onSortToggle("name")}
              >
                <div className="flex items-center">Location Site {renderSortIcon("name")}</div>
              </th>
              <th 
                className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase cursor-pointer group select-none"
                onClick={() => onSortToggle("pm25")}
              >
                <div className="flex items-center">PM2.5 (µg/m³) {renderSortIcon("pm25")}</div>
              </th>
              <th 
                className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase cursor-pointer group select-none"
                onClick={() => onSortToggle("pm10")}
              >
                <div className="flex items-center">PM10 (µg/m³) {renderSortIcon("pm10")}</div>
              </th>
              <th className="py-4 px-6 text-xs font-black tracking-wider text-gray-500 uppercase">Last Sync</th>
              <th className="py-4 px-6 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
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
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        site.status === "good" ? "bg-[#009B9E] shadow-[0_0_8px_rgba(0,155,158,0.5)]" : 
                        site.status === "warning" ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" : 
                        site.status === "danger" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : 
                        "bg-gray-300"
                      }`} />
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-bold text-gray-800">{site.name}</p>
                    <p className="text-xs font-semibold text-gray-400">ID: {site.id}</p>
                  </td>
                  <td className="py-4 px-6 font-black text-gray-700">{site.pm25 !== null ? site.pm25 : "—"}</td>
                  <td className="py-4 px-6 font-black text-gray-700">{site.pm10 !== null ? site.pm10 : "—"}</td>
                  <td className="py-4 px-6 text-sm font-semibold text-gray-500">{site.lastUpdated}</td>
                  <td className="py-4 px-6 text-right">
                    <button 
                        aria-label={`View details for ${site.name}`}
                        className="p-2 text-gray-300 group-hover:text-[#005A8C] group-hover:bg-[#005A8C]/10 rounded-lg transition-all"
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