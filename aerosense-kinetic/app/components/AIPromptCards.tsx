// src/components/AIPromptCards.tsx
"use client";

import { Sparkles, BarChart3, ShieldAlert, Zap } from "lucide-react";

interface AIPromptCardsProps {
  onSelectPrompt: (prompt: string) => void;
}

export default function AIPromptCards({ onSelectPrompt }: AIPromptCardsProps) {
  const suggestions = [
    {
      text: "Analyze the recent PM2.5 breach at Da Nang Industrial Zone.",
      icon: <ShieldAlert className="text-[#F28C28]" size={20} />,
      tag: "Incident Report",
    },
    {
      text: "Predict air quality trends for Hanoi over the next 24 hours.",
      icon: <Zap className="text-[#009B9E]" size={20} />,
      tag: "Predictive Analytics",
    },
    {
      text: "Generate an EPA compliance summary for Ho Chi Minh City.",
      icon: <BarChart3 className="text-[#005A8C]" size={20} />,
      tag: "Compliance Documentation",
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="text-center mb-10 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-[#009B9E]/20 blur-3xl rounded-full pointer-events-none" />
        
        <div className="relative w-14 h-14 bg-white/60 backdrop-blur-xl border border-white/80 shadow-[0_8px_30px_rgba(0,155,158,0.15)] rounded-2xl flex items-center justify-center mx-auto mb-5 text-[#005A8C]">
          <Sparkles size={28} className="animate-pulse" />
        </div>
        <h2 className="relative text-3xl font-black tracking-tight text-gray-800 drop-shadow-sm">AeroSense Intelligence</h2>
        <p className="relative text-sm font-bold text-gray-500 mt-2">
          Ask questions, analyze compliance issues, or predict sensor behaviors.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt(suggestion.text)}
            className="p-5 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-3xl text-left hover:bg-white/70 hover:border-white hover:shadow-[0_10px_40px_rgba(0,90,140,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between gap-5 group cursor-pointer overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative z-10 p-3 bg-white/80 backdrop-blur-md border border-white rounded-2xl w-fit shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              {suggestion.icon}
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 group-hover:text-[#005A8C] transition-colors">
                {suggestion.tag}
              </p>
              <p className="text-sm font-bold text-gray-800 line-clamp-3 leading-relaxed">
                {suggestion.text}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}