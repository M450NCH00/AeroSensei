// src/components/AIChatInput.tsx
"use client";

import React, { useState } from "react";
import { SendHorizontal, Loader2 } from "lucide-react";

interface AIChatInputProps {
  onSendMessage: (text: string) => void;
  disabled: boolean;
}

export default function AIChatInput({ onSendMessage, disabled }: AIChatInputProps) {
  const [inputText, setInputText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || disabled) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="w-full max-w-3xl mx-auto bg-white/60 backdrop-blur-3xl border border-white/60 rounded-full p-2 flex items-center shadow-[0_8px_40px_rgba(0,0,0,0.04)] focus-within:shadow-[0_8px_40px_rgba(0,90,140,0.1)] focus-within:bg-white/90 focus-within:border-white transition-all duration-300"
    >
      <input
        type="text"
        disabled={disabled}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder={disabled ? "AeroSense Core is analyzing telemetry..." : "Ask AeroSense Intelligence..."}
        className="flex-grow pl-5 pr-3 py-3 text-sm bg-transparent outline-none text-gray-800 placeholder:text-gray-400 font-medium disabled:cursor-not-allowed"
      />
      
      <button
        type="submit"
        disabled={!inputText.trim() || disabled}
        aria-label="Send message to AI assistant"
        title="Send Message"
        className="h-10 w-10 sm:h-auto sm:w-auto sm:px-6 sm:py-3 bg-gradient-to-r from-[#005A8C] to-[#0070ab] text-white rounded-full hover:shadow-lg hover:shadow-[#005A8C]/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:hover:shadow-none disabled:hover:translate-y-0 disabled:cursor-not-allowed group"
      >
        <span className="hidden sm:block text-xs font-black uppercase tracking-wider">Send</span>
        {disabled ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <SendHorizontal size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        )}
      </button>
    </form>
  );
}