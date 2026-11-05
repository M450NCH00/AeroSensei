// src/components/AIChatMessage.tsx
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
          {isBot ? (
            <MarkdownContent content={message.content} />
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        <span className="text-[10px] font-bold text-gray-400 mt-2 px-2 tracking-widest uppercase">
          {message.timestamp}
        </span>
      </div>
    </div>
  );
}

// Renders the assistant's Markdown (bold, links, lists, tables, code) with
// styling that matches the chat bubble. Links open in a new tab.
function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="space-y-2 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#009B9E] font-semibold underline underline-offset-2 hover:text-[#007d80] break-all"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-bold text-[#005A8C]">{children}</strong>,
          ul: ({ children }) => <ul className="list-disc ml-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ml-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-black text-[#005A8C] mt-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-black text-[#005A8C] mt-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold text-[#005A8C] mt-1">{children}</h3>,
          code: ({ children }) => (
            <code className="bg-gray-100 text-[#005A8C] px-1 py-0.5 rounded text-[0.85em] font-mono">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="bg-gray-50 border border-gray-100 rounded-xl p-3 overflow-x-auto text-xs">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gray-200 pl-3 text-gray-500 italic">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-gray-200 px-2 py-1 bg-gray-50 font-bold text-left">{children}</th>,
          td: ({ children }) => <td className="border border-gray-200 px-2 py-1">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
