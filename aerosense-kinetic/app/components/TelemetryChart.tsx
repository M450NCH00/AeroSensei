// src/components/TelemetryChart.tsx
import { 
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine 
} from "recharts";

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

// 1. FANCY UPGRADE: Custom Glassmorphism Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/70 backdrop-blur-2xl border border-white/60 p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] transition-all">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-200/50 pb-2">
          {label}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-3 mb-1.5 last:mb-0">
            <div 
              className="w-2.5 h-2.5 rounded-full shadow-sm" 
              style={{ backgroundColor: entry.color }} 
            />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {entry.name.replace("Historical ", "")}:
            </span>
            <span className="text-sm font-black text-gray-800">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function TelemetryChart({ 
  title, data, dataKey, lineColor, warningThreshold, breachThreshold 
}: TelemetryChartProps) {
  
  // Create a unique ID for the gradient so multiple charts don't conflict
  const gradientId = `color-${dataKey.replace(/\./g, "")}`;

  return (
    // Removed the solid background to inherit the parent's glass container
    <div className="flex flex-col h-72 w-full">
      
      {/* Sleek Header with pulsing indicator */}
      <div className="flex items-center gap-2 mb-4 px-2">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: lineColor }} />
        <h4 className="text-sm font-black tracking-tight text-gray-800">{title}</h4>
      </div>
      
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {/* 2. FANCY UPGRADE: Swapped to ComposedChart to mix Areas and Lines */}
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            
            {/* SVG Definitions for Gradients and Glows */}
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineColor} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
              </linearGradient>
              {/* Optional glow filter for the forecast line */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Ultra-subtle grid lines */}
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(0,0,0,0.06)" />
            
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }}
            />
            
            {/* Inject our custom glass tooltip */}
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0,90,140,0.1)', strokeWidth: 2, strokeDasharray: '4 4' }} />
            
            {/* Sleek threshold lines */}
            <ReferenceLine 
              y={warningThreshold} 
              stroke="#FBBF24" 
              strokeDasharray="3 3" 
              strokeOpacity={0.6}
              label={{ position: 'insideTopLeft', value: 'WARNING', fill: '#FBBF24', fontSize: 9, fontWeight: 900, textAnchor: 'start' }} 
            />
            <ReferenceLine 
              y={breachThreshold} 
              stroke="#EF4444" 
              strokeDasharray="3 3" 
              strokeOpacity={0.6}
              label={{ position: 'insideTopLeft', value: 'BREACHED', fill: '#EF4444', fontSize: 9, fontWeight: 900, textAnchor: 'start' }} 
            />
            
            {/* 3. FANCY UPGRADE: Area Component for Historical Data */}
            <Area 
              type="monotone" 
              dataKey="value" 
              name={`Historical ${dataKey}`}
              stroke={lineColor} 
              strokeWidth={3} 
              fillOpacity={1} 
              fill={`url(#${gradientId})`} // References our custom gradient
              activeDot={{ r: 6, strokeWidth: 0, fill: lineColor, style: { filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.3))'} }} 
              connectNulls
            />

            {/* 4. FANCY UPGRADE: AI Forecast Line with Glow */}
            <Line 
              type="monotone" 
              dataKey="forecast" 
              name={`AI Forecast (3H)`}
              stroke="#8B5CF6" 
              strokeWidth={3} 
              strokeDasharray="6 6" 
              dot={{ r: 4, strokeWidth: 2, fill: "white", stroke: "#8B5CF6" }} 
              activeDot={{ r: 6, strokeWidth: 0, fill: "#8B5CF6", style: { filter: 'drop-shadow(0px 0px 8px rgba(139,92,246,0.8))'} }} 
              connectNulls
              style={{ filter: "url(#glow)" }} // Applies the neon glow effect
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}