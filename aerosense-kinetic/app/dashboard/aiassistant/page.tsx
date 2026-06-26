// src/app/dashboard/aiassistant/page.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, MessageSquare, Trash2, Loader2, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import axiosInstance from "@/app/api/axiosInstance";
import AIPromptCards from "@/app/components/AIPromptCards";
import AIChatMessage from "@/app/components/AIChatMessage";
import AIChatInput from "@/app/components/AIChatInput";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface Conversation {
  id: number;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

// Only the most recent turns are sent to the agent for context (keeps the
// request within the model's window as history grows).
const CONTEXT_TURNS = 12;

const fmtTime = (iso?: string) =>
  (iso ? new Date(iso) : new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function AIAssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  // History panel starts collapsed each time the tab is opened so it doesn't
  // squeeze the chat; the user can expand it from the header toggle.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await axiosInstance.get<Conversation[]>("/chat/conversations");
      setConversations(res.data || []);
    } catch {
      // non-fatal — chat still works in-memory if persistence is unreachable
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const openConversation = async (id: number) => {
    if (id === activeId) return;
    setActiveId(id);
    setMessages([]);
    try {
      const res = await axiosInstance.get<{ id: number; role: Message["role"]; content: string; createdAt: string }[]>(
        `/chat/conversations/${id}/messages`
      );
      setMessages((res.data || []).map((m) => ({
        id: String(m.id), role: m.role, content: m.content, timestamp: fmtTime(m.createdAt),
      })));
    } catch {
      // leave empty on failure
    }
  };

  const startNewChat = () => {
    setActiveId(null);
    setMessages([]);
  };

  const deleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      await axiosInstance.delete(`/chat/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeId) startNewChat();
    } catch {
      // non-fatal
    }
  };

  const handleProcessUserQuery = async (text: string) => {
    const historyBefore = messages.map((m) => ({ role: m.role, content: m.content }));
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text, timestamp: fmtTime() };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    // Ensure a conversation exists to persist into (create lazily on first message).
    let conversationId = activeId;
    try {
      if (conversationId == null) {
        const res = await axiosInstance.post<Conversation>("/chat/conversations", { title: text.slice(0, 80) });
        conversationId = res.data.id;
        setActiveId(conversationId);
      }
    } catch {
      conversationId = null; // persistence unavailable; continue in-memory
    }

    let answer = "Sorry, I could not reach the AI agent. Please check that the service is running.";
    try {
      const aiAgentUrl = process.env.NEXT_PUBLIC_AI_AGENT_URL || "http://localhost:5001";
      const res = await fetch(`${aiAgentUrl}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question: text, messages: historyBefore.slice(-CONTEXT_TURNS * 2) }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      answer = data.answer;
    } catch {
      // answer stays as the fallback message
    }

    const botMessage: Message = { id: crypto.randomUUID(), role: "assistant", content: answer, timestamp: fmtTime() };
    setMessages((prev) => [...prev, botMessage]);
    setIsTyping(false);

    // Persist the full turn, then refresh the sidebar (title/order).
    if (conversationId != null) {
      try {
        await axiosInstance.post(`/chat/conversations/${conversationId}/messages`, {
          messages: [
            { role: "user", content: text },
            { role: "assistant", content: answer },
          ],
        });
        loadConversations();
      } catch {
        // non-fatal — message is already shown in the UI
      }
    }
  };

  return (
    <div className="h-screen flex bg-[#F1F5F9] relative overflow-hidden p-4 md:p-6 gap-4">
      
      {/* THE AMBIENT AURA BACKGROUND */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-[#009B9E]/20 rounded-full mix-blend-multiply opacity-60 animate-blob-shift" />
        <div className="absolute top-[30%] right-[-10%] w-[35rem] h-[35rem] bg-[#005A8C]/15 rounded-full mix-blend-multiply opacity-60 animate-blob-shift animation-delay-2000" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40rem] h-[40rem] bg-[#009B9E]/10 rounded-full mix-blend-multiply opacity-50 animate-blob-shift animation-delay-4000" />
      </div>

      {/* FANCY UPGRADE: Floating Glassmorphism History Sidebar */}
      <aside className={`relative z-10 w-72 flex-shrink-0 bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex-col transition-all duration-500 overflow-hidden ${sidebarOpen ? "flex" : "hidden"}`}>
        
        <div className="p-5 border-b border-gray-100/50 space-y-4 bg-white/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">History</span>
            <button
              onClick={() => setSidebarOpen(false)}
              title="Collapse history"
              className="p-1.5 rounded-xl text-gray-400 hover:bg-white hover:shadow-sm hover:text-[#005A8C] transition-all cursor-pointer"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
          
          {/* Premium Gradient New Chat Button */}
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#005A8C] to-[#0070ab] text-white text-xs font-black uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-[#005A8C]/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={16} /> New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300/50 [&::-webkit-scrollbar-thumb]:rounded-full">
          {loadingConvos ? (
            <div className="flex justify-center py-8"><Loader2 size={18} className="text-[#005A8C] animate-spin" /></div>
          ) : conversations.length === 0 ? (
            <p className="text-xs font-semibold text-gray-400 text-center py-8 px-4 opacity-70">No conversations yet. Start chatting to save your history.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`w-full group flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-300 cursor-pointer border ${
                  c.id === activeId 
                    ? "bg-white/80 border-white shadow-sm shadow-[#009B9E]/10 text-[#005A8C] font-black" 
                    : "border-transparent text-gray-500 hover:bg-white/50 hover:border-white/60 hover:text-[#005A8C]"
                }`}
              >
                <MessageSquare size={15} className={`flex-shrink-0 ${c.id === activeId ? "text-[#009B9E]" : "opacity-50 group-hover:opacity-100"}`} />
                <span className="flex-1 text-xs tracking-wide truncate">{c.title || "Untitled chat"}</span>
                <Trash2
                  size={14}
                  onClick={(e) => deleteConversation(c.id, e)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-500 hover:scale-110 transition-all"
                />
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main conversation column */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        
        {/* FANCY UPGRADE: Floating Glass Header */}
        {!sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className="absolute top-6 left-6 z-30 p-2.5 bg-white/60 backdrop-blur-md border border-white/50 text-[#005A8C] rounded-xl shadow-sm hover:bg-white hover:shadow-md transition-all duration-300"
            title="Open History"          
          >
            <PanelLeftOpen size={20} />
          </button>
        )}

        {/* Chat Canvas */}
        <div className="flex-1 overflow-y-auto px-2 space-y-6 flex flex-col [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400/60">
          
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center">
              <AIPromptCards onSelectPrompt={handleProcessUserQuery} />
            </div>
          ) : (
            <div className="py-4 space-y-6">
              {messages.map((message) => <AIChatMessage key={message.id} message={message} />)}
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
        <footer className="flex-shrink-0 pt-4 pb-2">
          <AIChatInput onSendMessage={handleProcessUserQuery} disabled={isTyping} />
        </footer>
      </div>
    </div>
  );
}
