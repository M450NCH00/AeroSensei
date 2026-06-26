// src/app/dashboard/aiassistant/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import AIPromptCards from "@/app/components/AIPromptCards";
import AIChatMessage from "@/app/components/AIChatMessage";
import AIChatInput from "@/app/components/AIChatInput";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleProcessUserQuery = async (text: string) => {
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text, timestamp: getCurrentTime() };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const aiAgentUrl = process.env.NEXT_PUBLIC_AI_AGENT_URL || "http://localhost:5001";
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(`${aiAgentUrl}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question: text, messages: history }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.answer, timestamp: getCurrentTime() }]);
    } catch {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "AI Core offline. Please check telemetry connection.", timestamp: getCurrentTime() }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#F1F5F9] relative overflow-hidden p-4 md:p-8">
      
      {/* THE AMBIENT AURA BACKGROUND */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-[#009B9E]/20 rounded-full mix-blend-multiply opacity-60 animate-blob-shift" />
        <div className="absolute top-[30%] right-[-10%] w-[35rem] h-[35rem] bg-[#005A8C]/15 rounded-full mix-blend-multiply opacity-60 animate-blob-shift animation-delay-2000" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40rem] h-[40rem] bg-[#009B9E]/10 rounded-full mix-blend-multiply opacity-50 animate-blob-shift animation-delay-4000" />
      </div>

      {/* Main Conversation Canvas */}
      <div className="relative z-10 flex-1 overflow-y-auto px-2 space-y-6 flex flex-col [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300/50 [&::-webkit-scrollbar-thumb]:rounded-full">
        
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center">
            <AIPromptCards onSelectPrompt={handleProcessUserQuery} />
          </div>
        ) : (
          <div className="py-4 space-y-6">
            {messages.map((message) => (
              <AIChatMessage key={message.id} message={message} />
            ))}
          </div>
        )}

        {/* Neural Processing State */}
        {isTyping && (
          <div className="flex gap-4 w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300 pb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#005A8C] to-[#009B9E] text-white flex items-center justify-center text-xs font-black shadow-[0_0_15px_rgba(0,155,158,0.3)] shrink-0">
              AI
            </div>
            <div className="bg-white/70 backdrop-blur-2xl border border-white/60 p-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2 h-[42px] mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#009B9E] animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#009B9E] animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#005A8C] animate-bounce" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-2 shrink-0" />
      </div>

      {/* Floating Footer Input */}
      <footer className="relative z-10 flex-shrink-0 pt-4 pb-2">
        <AIChatInput onSendMessage={handleProcessUserQuery} disabled={isTyping} />
      </footer>
    </div>
  );
}