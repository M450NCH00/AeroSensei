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
    <div className={`flex gap-4 w-full max-w-3xl mx-auto ${isBot ? "" : "flex-row-reverse"}`}>
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-2xs ${
        isBot 
          ? "bg-[#005A8C] border-[#005A8C] text-white" 
          : "bg-white border-gray-200 text-gray-600"
      }`}>
        {isBot ? <Bot size={18} /> : <User size={18} />}
      </div>

      {/* Message Bubble */}
      <div className={`flex flex-col max-w-[80%] ${isBot ? "items-start" : "items-end"}`}>
        <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
          isBot 
            ? "bg-white border border-gray-100 text-gray-800 shadow-2xs" 
            : "bg-[#005A8C] text-white font-medium shadow-2xs"
        }`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <span className="text-[10px] font-bold text-gray-400 mt-1.5 px-1 tracking-wide">
          {message.timestamp}
        </span>
      </div>
    </div>
  );
}