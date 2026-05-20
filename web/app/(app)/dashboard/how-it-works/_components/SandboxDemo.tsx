"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Cloud, Zap } from "lucide-react";
import { generateSessionId } from "@/lib/utils";

interface DemoMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const DEMO_SESSION_PREFIX = "demo-";

export function SandboxDemo() {
  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Live sandbox connected to the FixInventory graph. Ask me anything about the discovered AWS resources.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const sessionId = useRef(DEMO_SESSION_PREFIX + generateSessionId());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: DemoMessage = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: DemoMessage = { id: assistantId, role: "assistant", content: "", isStreaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, session_id: sessionId.current }),
      });

      if (!res.ok || !res.body) throw new Error();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Could not reach the agent. Make sure the backend is running." }
            : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col rounded-2xl overflow-hidden border border-white/[0.08] bg-black/20 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <div className="flex items-center gap-2 flex-1 justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-gray-500 font-mono">live sandbox · FixInventory graph</span>
        </div>
        <Zap className="w-3 h-3 text-brand-400/60" />
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <Cloud className="w-3 h-3 text-brand-400" />
              </div>
            )}
            <div
              className={`max-w-[85%] text-xs px-3 py-2 rounded-xl leading-relaxed whitespace-pre-line ${
                msg.role === "user"
                  ? "bg-brand-500 text-white rounded-tr-sm"
                  : "bg-white/[0.05] border border-white/[0.08] text-gray-300 rounded-tl-sm"
              } ${msg.isStreaming ? "streaming-cursor" : ""}`}
            >
              {msg.content || " "}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/[0.06] flex gap-2 items-center">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask about the AWS environment..."
          disabled={isLoading}
          className="flex-1 bg-transparent text-xs text-white placeholder-gray-600 outline-none"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          className="w-7 h-7 rounded-lg bg-brand-500 disabled:opacity-30 flex items-center justify-center transition-opacity hover:bg-brand-600"
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-white" />
          ) : (
            <Send className="w-3 h-3 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}
