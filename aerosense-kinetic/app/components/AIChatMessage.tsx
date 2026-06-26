// src/components/AIChatMessage.tsx
import { Bot, User } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface AIChatMessageProps {
  message: Message;
}

export default function AIChatMessage({ message }: AIChatMessageProps) {
  const isBot = message.role === "assistant";

  return (
    <div className={`flex gap-4 w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-3 duration-500 ${isBot ? "" : "flex-row-reverse"}`}>
      
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all hover:scale-105 shadow-sm ${
        isBot 
          ? "bg-gradient-to-br from-[#005A8C] to-[#009B9E] border-transparent text-white shadow-[0_0_15px_rgba(0,155,158,0.3)]" 
          : "bg-white/80 backdrop-blur-xl border-white text-[#005A8C]"
      }`}>
        {isBot ? <Bot size={20} /> : <User size={20} />}
      </div>

      {/* Message Bubble */}
      <div className={`flex flex-col max-w-[80%] ${isBot ? "items-start" : "items-end"}`}>
        <div className={`p-4 sm:p-5 rounded-3xl text-sm leading-relaxed tracking-wide shadow-sm ${
          isBot 
            ? "bg-white/70 backdrop-blur-2xl border border-white/80 text-gray-800 rounded-tl-sm hover:bg-white/80 transition-colors" 
            : "bg-gradient-to-br from-[#005A8C] to-[#0070ab] text-white font-medium rounded-tr-sm shadow-[0_8px_30px_rgba(0,90,140,0.15)]"
        }`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <span className="text-[10px] font-bold text-gray-400 mt-2 px-2 tracking-widest uppercase">
          {message.timestamp}
        </span>
      </div>
    </div>
  );
}