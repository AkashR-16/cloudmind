"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Cloud, Play, RotateCcw } from "lucide-react";

interface DemoMsg {
  role: "user" | "assistant";
  text: string;
}

const SCRIPT: Array<{ role: "user" | "assistant"; text: string; delay: number }> = [
  { role: "user",      text: "Which EC2 instances are currently running?", delay: 800 },
  { role: "assistant", text: "Found **3 running** EC2 instances in `us-east-1`:\n- **web-server-01** (t3.medium) · `i-001`\n- **api-server-01** (t3.large) · `i-002`\n- **worker-node-1** (t3.small) · `i-003`", delay: 1800 },
  { role: "user",      text: "Are any S3 buckets publicly accessible?", delay: 3200 },
  { role: "assistant", text: "⚠️ **Security alert** — `my-app-assets` has public access enabled.\n\nBlock Public Access is **off**. Recommend reviewing the bucket policy immediately.", delay: 5000 },
  { role: "user",      text: "Which of those EC2 instances have public IPs?", delay: 7000 },
  { role: "assistant", text: "2 of 3 instances have public IPs:\n- **web-server-01** → `54.210.x.x`\n- **api-server-01** → `52.90.x.x`\n\n`worker-node-1` is internal only.", delay: 8800 },
];

const CHAR_DELAY = 18;

function renderText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, li) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <span key={li}>
        {parts.map((part, pi) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={pi} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith("`") && part.endsWith("`")) {
            return <code key={pi} className="text-brand-400 bg-black/20 px-1 rounded text-[11px] font-mono">{part.slice(1, -1)}</code>;
          }
          return <span key={pi}>{part}</span>;
        })}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

export function AnimatedDemo() {
  const [messages, setMessages] = useState<DemoMsg[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const reset = useCallback(() => {
    clearTimeouts();
    setMessages([]);
    setStreaming(null);
    setRunning(false);
    setDone(false);
  }, [clearTimeouts]);

  const play = () => {
    reset();
    setRunning(true);

    SCRIPT.forEach((entry, idx) => {
      const startT = setTimeout(() => {
        if (entry.role === "user") {
          setMessages((prev) => [...prev, { role: "user", text: entry.text }]);
        } else {
          setStreaming("");
          let charIdx = 0;
          const fullText = entry.text;
          const typeInterval = setInterval(() => {
            charIdx++;
            setStreaming(fullText.slice(0, charIdx));
            if (charIdx >= fullText.length) {
              clearInterval(typeInterval);
              setMessages((prev) => [...prev, { role: "assistant", text: fullText }]);
              setStreaming(null);
              if (idx === SCRIPT.length - 1) {
                setRunning(false);
                setDone(true);
              }
            }
          }, CHAR_DELAY);
          timeoutsRef.current.push(startT);
        }
      }, entry.delay);
      timeoutsRef.current.push(startT);
    });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => () => clearTimeouts(), [clearTimeouts]);

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Terminal chrome */}
      <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs text-gray-600 font-mono">cloudmind · animated demo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${running ? "bg-green-500 animate-pulse" : "bg-gray-700"}`} />
            <span className="text-[10px] text-gray-600">{running ? "live" : done ? "done" : "ready"}</span>
          </div>
        </div>

        <div className="h-64 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !running && !streaming && (
            <div className="flex items-center justify-center h-full text-gray-700 text-sm">
              Press Play to start the demo
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""} animate-fade-in`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Cloud className="w-3 h-3 text-brand-400" />
                </div>
              )}
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-brand-500 text-white rounded-tr-sm"
                    : "bg-white/[0.05] border border-white/[0.08] text-gray-300 rounded-tl-sm"
                }`}
              >
                {msg.role === "assistant" ? renderText(msg.text) : msg.text}
              </div>
            </div>
          ))}

          {/* Streaming assistant message */}
          {streaming !== null && (
            <div className="flex gap-2.5 animate-fade-in">
              <div className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <Cloud className="w-3 h-3 text-brand-400" />
              </div>
              <div className="max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed bg-white/[0.05] border border-white/[0.08] text-gray-300 rounded-tl-sm streaming-cursor">
                {streaming ? renderText(streaming) : <span className="opacity-0">·</span>}
              </div>
            </div>
          )}

          {/* Typing indicator — when user msg was added but assistant hasn't started yet */}
          {running && streaming === null && messages.length > 0 && messages[messages.length - 1].role === "user" && (
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
                <Cloud className="w-3 h-3 text-brand-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl rounded-tl-sm px-3 py-2.5 flex gap-1 items-center">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-gray-500 animate-typing" style={{ animationDelay: `${delay}s` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {!running && !done && (
          <button
            onClick={play}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-all hover:shadow-lg hover:shadow-brand-500/25 active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Play Demo
          </button>
        )}
        {(running || done) && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2 rounded-xl border border-surface-border hover:border-gray-600 text-gray-400 hover:text-white text-sm font-medium transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart
          </button>
        )}
        {done && (
          <span className="text-xs text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Demo complete
          </span>
        )}
      </div>
    </div>
  );
}
