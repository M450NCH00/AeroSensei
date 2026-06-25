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
          {isBot ? (
            <MarkdownContent content={message.content} />
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        <span className="text-[10px] font-bold text-gray-400 mt-1.5 px-1 tracking-wide">
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
