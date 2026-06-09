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
    <div className="w-full max-w-3xl mx-auto my-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-[#005A8C]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#005A8C]">
          <Sparkles size={24} className="animate-pulse" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-gray-800">AeroSense Intelligence</h2>
        <p className="text-sm font-semibold text-gray-400 mt-1">
          Ask questions, analyze compliance issues, or predict sensor behaviors.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt(suggestion.text)}
            className="p-5 bg-white border border-gray-200/80 rounded-2xl text-left hover:border-[#005A8C] hover:shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4 group cursor-pointer"
          >
            <div className="p-2.5 bg-gray-50 rounded-xl w-fit group-hover:bg-gray-100/80 transition-colors">
              {suggestion.icon}
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">
                {suggestion.tag}
              </p>
              <p className="text-sm font-bold text-gray-700 line-clamp-3 leading-relaxed">
                {suggestion.text}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}