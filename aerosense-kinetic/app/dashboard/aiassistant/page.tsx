// src/app/dashboard/aiassistant/page.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import AIPromptCards from "../../components/AIPromptCards";
import AIChatMessage from "../../components/AIChatMessage";
import AIChatInput from "../../components/AIChatInput";

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
    <div className="h-screen flex bg-[#F8FAFC]">

      {/* Conversation sidebar */}
      <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200/60 flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-gray-100">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#005A8C] text-white text-sm font-bold rounded-xl hover:bg-[#004a73] transition-all cursor-pointer"
          >
            <Plus size={16} /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingConvos ? (
            <div className="flex justify-center py-8"><Loader2 size={18} className="text-gray-300 animate-spin" /></div>
          ) : conversations.length === 0 ? (
            <p className="text-xs font-semibold text-gray-300 text-center py-8 px-4">No conversations yet. Start chatting to save your history.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`w-full group flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                  c.id === activeId ? "bg-[#009B9E]/10 text-[#009B9E]" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <MessageSquare size={15} className="flex-shrink-0 opacity-70" />
                <span className="flex-1 text-sm font-semibold truncate">{c.title || "Untitled chat"}</span>
                <Trash2
                  size={14}
                  onClick={(e) => deleteConversation(c.id, e)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-500 transition-opacity"
                />
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main conversation column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex-shrink-0 bg-white p-6 border-b border-gray-200/60 flex justify-between items-center z-10 shadow-2xs">
          <div>
            <h1 className="text-xl font-black text-[#005A8C] tracking-tight">AI Diagnostic Space</h1>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Predictive Language Assistant Modeling</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
          {messages.length === 0 ? (
            <AIPromptCards onSelectPrompt={handleProcessUserQuery} />
          ) : (
            messages.map((message) => <AIChatMessage key={message.id} message={message} />)
          )}

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

        <footer className="p-6 bg-linear-to-t from-[#F8FAFC] via-[#F8FAFC] to-transparent flex-shrink-0">
          <AIChatInput onSendMessage={handleProcessUserQuery} disabled={isTyping} />
        </footer>
      </div>
    </div>
  );
}
