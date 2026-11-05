import React from 'react';
import { Leaf } from 'lucide-react';

interface AdvisoryProps {
  currentScore: number | null;
  regionName: string | null;
}

export default function HealthAdvisory({ currentScore, regionName }: AdvisoryProps) {
  if (currentScore === null) {
    return (
      <div className="absolute bottom-10 left-6 z-[1010] bg-white/70 backdrop-blur-2xl border border-white/60 p-5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] max-w-xs transition-all duration-500 hover:scale-105 group">
        <div className="flex items-center gap-3 text-[#005A8C]">
          <Leaf className="group-hover:text-[#009B9E] group-hover:rotate-12 transition-all duration-300" size={24} />
          <p className="text-sm font-bold tracking-wide">Hover or click a district to view insights.</p>
        </div>
      </div>
    );
  }

  const getMOHGuidance = (score: number) => {
    if (score >= 80) return { status: 'Hazardous', color: 'text-red-500', bg: 'bg-red-50', mask: 'Highly Recommended (N95)', outdoor: 'Avoid strenuous activities.' };
    if (score >= 60) return { status: 'Unhealthy', color: 'text-orange-500', bg: 'bg-orange-50', mask: 'Recommended for vulnerable', outdoor: 'Reduce prolonged exertion.' };
    if (score >= 40) return { status: 'Moderate', color: 'text-yellow-600', bg: 'bg-yellow-50', mask: 'Not necessary', outdoor: 'Normal participation safe.' };
    return { status: 'Clean Air', color: 'text-[#009B9E]', bg: 'bg-[#009B9E]/10', mask: 'Not required', outdoor: 'Safe for all normal activities.' };
  };

  const guidance = getMOHGuidance(currentScore);

  return (
    <div className="absolute bottom-10 left-6 z-[1010] bg-white/80 backdrop-blur-3xl border border-white/80 p-6 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] w-80 transition-all duration-500 animate-in slide-in-from-bottom-5">
      <h3 className="text-xl font-black text-[#005A8C] mb-1 tracking-tight">{regionName}</h3>
      
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-4 ${guidance.bg}`}>
        <span className="font-bold text-gray-700 text-sm">Index:</span>
        <span className={`font-black text-lg ${guidance.color}`}>{currentScore}</span>
        <span className={`text-xs font-bold uppercase tracking-wider ${guidance.color}`}>({guidance.status})</span>
      </div>
      
      <div className="space-y-3 text-sm text-gray-600">
        <div className="bg-white/50 p-3 rounded-xl border border-gray-100">
          <span className="font-bold text-[#005A8C] block mb-0.5">Mask Advisory</span>
          {guidance.mask}
        </div>
        <div className="bg-white/50 p-3 rounded-xl border border-gray-100">
          <span className="font-bold text-[#005A8C] block mb-0.5">Activity Guidance</span>
          {guidance.outdoor}
        </div>
      </div>
    </div>
  );
}