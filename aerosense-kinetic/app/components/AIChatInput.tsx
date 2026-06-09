// src/components/AIChatInput.tsx
"use client";

import React, { useState } from "react";
import { SendHorizontal } from "lucide-react";

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
      className="w-full max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl p-2 flex items-center shadow-xs focus-within:ring-2 focus-within:ring-[#005A8C]/10 focus-within:border-[#005A8C] transition-all"
    >
      <input
        type="text"
        disabled={disabled}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder={disabled ? "AeroSense Bot is crafting a response..." : "Ask AeroSense Assistant..."}
        className="flex-grow pl-4 pr-3 py-2 text-sm bg-transparent outline-none text-gray-800 disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={!inputText.trim() || disabled}
        aria-label="Send message to AI assistant"
        title="Send Message"
        className="p-3 bg-[#005A8C] text-white rounded-xl hover:bg-[#00426b] transition-all flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:hover:bg-[#005A8C] disabled:cursor-not-allowed"
      >
        <SendHorizontal size={16} />
      </button>
    </form>
  );
}