// src/components/SensorsTable.tsx
import { Trash2, Cpu, Activity } from "lucide-react";
import RequirePermission from "../components/RequirePermission";

export interface SensorData {
  id: string;
  status: string;
}

interface SensorsTableProps {
  sensors: SensorData[];
  isLoading: boolean;
  onDelete: (sensorId: string) => void;
}

export default function SensorsTable({ sensors, isLoading, onDelete }: SensorsTableProps) {
  // Helper to color-code statuses
  const getStatusStyle = (status: string) => {
    const s = status?.toLowerCase() || "";
    if (s.includes("active") || s.includes("online") || s.includes("good")) 
      return "bg-emerald-100 text-emerald-700";
    if (s.includes("warning") || s.includes("moderate")) 
      return "bg-amber-100 text-amber-700";
    if (s.includes("offline") || s.includes("danger") || s.includes("error")) 
      return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              <th className="py-3 px-6 text-xs font-black tracking-wider text-gray-500 uppercase">Hardware ID</th>
              <th className="py-3 px-6 text-xs font-black tracking-wider text-gray-500 uppercase">Telemetry Status</th>
              <th className="py-3 px-6 text-xs font-black tracking-wider text-gray-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-sm font-bold text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#005A8C] border-t-transparent rounded-full animate-spin" />
                    Fetching sensor telemetry...
                  </div>
                </td>
              </tr>
            ) : sensors.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-sm font-bold text-gray-400">
                  No sensors deployed at this site yet.
                </td>
              </tr>
            ) : (
              sensors.map((sensor) => (
                <tr key={sensor.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#005A8C]/10 rounded-lg text-[#005A8C]">
                        <Cpu size={16} />
                      </div>
                      <span className="font-bold text-gray-800">{sensor.id}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex w-max items-center gap-1.5 ${getStatusStyle(sensor.status)}`}>
                      <Activity size={12} />
                      {sensor.status || "UNKNOWN"}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    
                    {/* Security Check: Only render the delete button if they have permission */}
                    <RequirePermission permission="DELETE_SENSORS">
                      <button 
                        onClick={() => onDelete(sensor.id)}
                        aria-label="Delete Sensor"
                        className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </RequirePermission>

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