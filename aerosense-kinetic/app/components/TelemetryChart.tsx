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

// Helper to determine MOH Advice based on dynamic thresholds
const getMOHAdvice = (value: number, warning: number, breach: number) => {
  if (value >= breach) {
    return { text: "Hazardous: N95 Mask Required. Avoid outdoor exertion.", color: "text-red-500", bg: "bg-red-50/80" };
  }
  if (value >= warning) {
    return { text: "Unhealthy: Reduce prolonged outdoor activities.", color: "text-orange-500", bg: "bg-orange-50/80" };
  }
  return { text: "Safe: Normal activities permitted.", color: "text-[#009B9E]", bg: "bg-[#009B9E]/10" };
};

// 1. FANCY UPGRADE: Custom Glassmorphism Tooltip with MOH Injection
const CustomTooltip = ({ active, payload, label, warning, breach }: any) => {
  if (active && payload && payload.length) {
    // Get the highest value currently being hovered (either historical or forecast)
    const activeValue = payload[0].value;
    const advice = getMOHAdvice(activeValue, warning, breach);

    return (
      <div className="bg-white/80 backdrop-blur-3xl border border-white/80 p-4 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all min-w-[220px]">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-200/50 pb-2">
          {label}
        </p>
        
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 mb-2 last:mb-0">
            <div className="flex items-center gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full shadow-sm" 
                style={{ backgroundColor: entry.color }} 
              />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {entry.name.replace("Historical ", "")}:
              </span>
            </div>
            <span className="text-sm font-black text-[#005A8C]">
              {entry.value} <span className="text-[10px] text-gray-400 font-medium">µg/m³</span>
            </span>
          </div>
        ))}

        {/* MOH Advisory Block Inside Tooltip */}
        <div className={`mt-3 p-2 rounded-xl border border-white/50 ${advice.bg}`}>
          <p className={`text-[10px] font-black uppercase tracking-wider ${advice.color} mb-0.5`}>MOH Advisory</p>
          <p className="text-xs font-semibold text-gray-700 leading-tight">{advice.text}</p>
        </div>
      </div>
    );
  }
  return null;
};

export default function TelemetryChart({ 
  title, data, dataKey, lineColor, warningThreshold, breachThreshold 
}: TelemetryChartProps) {
  
  const gradientId = `color-${dataKey.replace(/\./g, "")}`;

  return (
    <div className="flex flex-col h-72 w-full">
      <div className="flex items-center gap-2 mb-4 px-2">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: lineColor }} />
        <h4 className="text-sm font-black tracking-tight text-gray-800">{title}</h4>
      </div>
      
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineColor} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(0,0,0,0.06)" />
            
            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }} />
            
            {/* Pass thresholds to CustomTooltip to calculate MOH Advice dynamically */}
            <Tooltip 
              content={<CustomTooltip warning={warningThreshold} breach={breachThreshold} />} 
              cursor={{ stroke: 'rgba(0,90,140,0.1)', strokeWidth: 2, strokeDasharray: '4 4' }} 
            />
            
            <ReferenceLine y={warningThreshold} stroke="#FBBF24" strokeDasharray="3 3" strokeOpacity={0.6} label={{ position: 'insideTopLeft', value: 'WARNING', fill: '#FBBF24', fontSize: 9, fontWeight: 900, textAnchor: 'start' }} />
            <ReferenceLine y={breachThreshold} stroke="#EF4444" strokeDasharray="3 3" strokeOpacity={0.6} label={{ position: 'insideTopLeft', value: 'BREACHED', fill: '#EF4444', fontSize: 9, fontWeight: 900, textAnchor: 'start' }} />
            
            <Area type="monotone" dataKey="value" name={`Historical ${dataKey}`} stroke={lineColor} strokeWidth={3} fillOpacity={1} fill={`url(#${gradientId})`} activeDot={{ r: 6, strokeWidth: 0, fill: lineColor, style: { filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.3))'} }} connectNulls />

            <Line type="monotone" dataKey="forecast" name={`AI Forecast (3H)`} stroke="#8B5CF6" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 4, strokeWidth: 2, fill: "white", stroke: "#8B5CF6" }} activeDot={{ r: 6, strokeWidth: 0, fill: "#8B5CF6", style: { filter: 'drop-shadow(0px 0px 8px rgba(139,92,246,0.8))'} }} connectNulls style={{ filter: "url(#glow)" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}