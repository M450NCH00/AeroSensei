// src/app/dashboard/aiassistant/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import AIPromptCards from "../../components/AIPromptCards";
import AIChatMessage from "../../components/AIChatMessage";
import AIChatInput from "../../components/AIChatInput";

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

  // Auto-scroll layout handler to push to the newest response frame
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleProcessUserQuery = async (text: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: getCurrentTime(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const aiAgentUrl = process.env.NEXT_PUBLIC_AI_AGENT_URL || "http://localhost:5001";
      const res = await fetch(`${aiAgentUrl}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      const botMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        timestamp: getCurrentTime(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I could not reach the AI agent. Please check that the service is running.",
        timestamp: getCurrentTime(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC]">
      
      {/* Top Banner Context Header */}
      <header className="flex-shrink-0 bg-white p-6 border-b border-gray-200/60 flex justify-between items-center z-10 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-[#005A8C] tracking-tight">AI Diagnostic Space</h1>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Predictive Language Assistant Modeling</p>
        </div>
      </header>

      {/* Main Conversation Frame Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
        {messages.length === 0 ? (
          // Renders Suggested cards ONLY if no statements have occurred
          <AIPromptCards onSelectPrompt={handleProcessUserQuery} />
        ) : (
          messages.map((message) => (
            <AIChatMessage key={message.id} message={message} />
          ))
        )}

        {/* Loading Bubble Presentation Shell */}
        {isTyping && (
          <div className="flex gap-4 w-full max-w-3xl mx-auto animate-pulse">
            <div className="w-9 h-9 rounded-xl bg-[#005A8C] text-white flex items-center justify-center text-xs font-bold border border-[#005A8C] shadow-2xs">
              AI
            </div>
            <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-2xs flex items-center gap-1.5 py-5">
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Form Footer Control Block */}
      <footer className="p-6 bg-linear-to-t from-[#F8FAFC] via-[#F8FAFC] to-transparent flex-shrink-0">
        <AIChatInput onSendMessage={handleProcessUserQuery} disabled={isTyping} />
      </footer>

    </div>
  );
}