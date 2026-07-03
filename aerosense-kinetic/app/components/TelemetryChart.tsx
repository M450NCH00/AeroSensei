// src/components/TelemetryChart.tsx
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine 
} from "recharts";

// 1. Add the optional 'forecast' property to our data points
export interface HistoryDataPoint {
  time: string;
  value?: number;    // Historical Data
  forecast?: number; // AI Predicted Data
}

interface TelemetryChartProps {
  title: string;
  data: HistoryDataPoint[];
  dataKey: string;
  lineColor: string;
  warningThreshold: number;
  breachThreshold: number;
}

export default function TelemetryChart({ 
  title, data, dataKey, lineColor, warningThreshold, breachThreshold 
}: TelemetryChartProps) {
  
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 h-72 flex flex-col">
      <h4 className="text-sm font-black text-gray-700 mb-4">{title}</h4>
      
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 600 }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 600 }}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
              labelStyle={{ color: '#9CA3AF', fontSize: '12px' }}
            />
            
            <ReferenceLine y={warningThreshold} stroke="#FBBF24" strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'WARNING', fill: '#FBBF24', fontSize: 10, fontWeight: 800 }} />
            <ReferenceLine y={breachThreshold} stroke="#EF4444" strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'BREACHED', fill: '#EF4444', fontSize: 10, fontWeight: 800 }} />
            
            {/* 2. The Standard Historical Line */}
            <Line 
              type="monotone" 
              dataKey="value" 
              name={`Historical ${dataKey}`}
              stroke={lineColor} 
              strokeWidth={3} 
              dot={false} 
              activeDot={{ r: 6, strokeWidth: 0 }} 
              connectNulls
            />

            {/* 3. The New AI Forecast Line (Dashed Purple) */}
            <Line 
              type="monotone" 
              dataKey="forecast" 
              name={`AI Forecast (3H)`}
              stroke="#8B5CF6" 
              strokeWidth={3} 
              strokeDasharray="6 6" 
              dot={{ r: 4, strokeWidth: 2, fill: "white" }} 
              activeDot={{ r: 6, strokeWidth: 0 }} 
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}