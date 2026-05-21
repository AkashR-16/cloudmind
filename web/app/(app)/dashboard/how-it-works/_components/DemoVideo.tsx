"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Cloud, User } from "lucide-react";

const TOTAL = 43;

function charsAt(t: number, start: number, end: number, text: string): string {
  if (t <= start) return "";
  if (t >= end) return text;
  return text.slice(0, Math.floor(((t - start) / (end - start)) * text.length));
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function BoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

function Lines({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <span className={`whitespace-pre-wrap leading-relaxed ${streaming ? "streaming-cursor" : ""}`}>
      {text.split("\n").map((line, i, arr) => (
        <span key={i}><BoldText text={line} />{i < arr.length - 1 ? "\n" : ""}</span>
      ))}
    </span>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 items-center px-2.5 py-2">
      {[0, 0.2, 0.4].map((d, i) => (
        <div key={i} className="w-1 h-1 rounded-full bg-gray-500 animate-typing" style={{ animationDelay: `${d}s` }} />
      ))}
    </div>
  );
}

const Q1 = "How many EC2 instances do I have?";
const A1 = "You have **4 EC2 instances** in us-east-1 (all currently terminated):\n• **web-server-01** (t3.medium)\n• **api-server-01** (t3.large)\n• **worker-node-1** (t3.small)\n• **worker-node-2** (t3.small)";
const Q2 = "Which security groups allow inbound 0.0.0.0/0?";
const A2 = "⚠️ **Security alert** — **web-tier-sg** allows unrestricted inbound traffic:\n\n• Port **80** (HTTP) from 0.0.0.0/0\n• Port **443** (HTTPS) from 0.0.0.0/0\n\nVerify this is intentional for public-facing services.";

// Timing (no login scene — starts straight at chat)
// t=0–1.5  : empty state
// t=1.5–7  : typing Q1
// t=7–8    : Q1 sent, typing dots for A1
// t=8–18   : A1 streaming
// t=18–19  : pause
// t=19–25  : typing Q2
// t=25–26  : Q2 sent, typing dots for A2
// t=26–43  : A2 streaming

function ChatScene({ t }: { t: number }) {
  const inputText =
    t < 1.5  ? ""
    : t < 7  ? charsAt(t, 1.5, 7, Q1)
    : t < 19 ? ""
    : t < 25 ? charsAt(t, 19, 25, Q2)
    : "";

  const showQ1      = t >= 7;
  const typingA1    = t >= 7 && t < 8;
  const a1Text      = t >= 8 ? charsAt(t, 8, 18, A1) : "";
  const a1Streaming = a1Text.length > 0 && a1Text.length < A1.length;

  const showQ2      = t >= 25;
  const typingA2    = t >= 25 && t < 26;
  const a2Text      = t >= 26 ? charsAt(t, 26, 43, A2) : "";
  const a2Streaming = a2Text.length > 0 && a2Text.length < A2.length;

  const showEmpty = !showQ1 && t >= 0;

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] bg-surface-card/40 backdrop-blur-xl px-4 py-2 flex items-center">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
            <Cloud className="w-3 h-3 text-brand-400" />
          </div>
          <span className="text-xs font-semibold">CloudMind</span>
        </div>
      </div>

      {/* Nav — only Chat + How It Works */}
      <div className="shrink-0 border-b border-white/[0.06] bg-white/[0.01] px-3 flex items-center gap-0.5 h-8">
        {["Chat", "How It Works"].map((tab, i) => (
          <div key={tab} className={`relative px-2.5 py-1 text-[9px] font-medium ${i === 0 ? "text-white" : "text-gray-600"}`}>
            {tab}
            {i === 0 && <span className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-brand-500 to-violet-400 rounded-t-full" />}
          </div>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden px-4 py-3 flex flex-col gap-2">
        {showEmpty && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
              <Cloud className="w-4 h-4 text-brand-400" />
            </div>
            <p className="text-[10px] text-gray-500 max-w-[150px]">Ask about your AWS environment</p>
          </div>
        )}

        <div className="space-y-2">
          {showQ1 && (
            <div className="flex gap-1.5 flex-row-reverse items-end">
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shrink-0">
                <User className="w-2.5 h-2.5 text-white" />
              </div>
              <div className="max-w-[78%] bg-gradient-to-br from-brand-500 to-brand-600 px-2.5 py-1.5 rounded-xl rounded-tr-sm text-[10px] text-white">{Q1}</div>
            </div>
          )}

          {(typingA1 || a1Text) && (
            <div className="flex gap-1.5 items-end">
              <div className="w-5 h-5 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
                <Cloud className="w-2.5 h-2.5 text-brand-400" />
              </div>
              <div className="max-w-[78%] bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 rounded-xl rounded-tl-sm text-[10px] text-gray-200">
                {typingA1 ? <TypingDots /> : <Lines text={a1Text} streaming={a1Streaming} />}
              </div>
            </div>
          )}

          {showQ2 && (
            <div className="flex gap-1.5 flex-row-reverse items-end">
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shrink-0">
                <User className="w-2.5 h-2.5 text-white" />
              </div>
              <div className="max-w-[78%] bg-gradient-to-br from-brand-500 to-brand-600 px-2.5 py-1.5 rounded-xl rounded-tr-sm text-[10px] text-white">{Q2}</div>
            </div>
          )}

          {(typingA2 || a2Text) && (
            <div className="flex gap-1.5 items-end">
              <div className="w-5 h-5 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
                <Cloud className="w-2.5 h-2.5 text-brand-400" />
              </div>
              <div className="max-w-[78%] bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 rounded-xl rounded-tl-sm text-[10px] text-gray-200">
                {typingA2 ? <TypingDots /> : <Lines text={a2Text} streaming={a2Streaming} />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-4 pb-3">
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition-all ${inputText ? "border-brand-500/40 bg-white/[0.04]" : "border-white/[0.07] bg-white/[0.02]"}`}>
          <span className="flex-1 text-[10px] text-white min-h-[14px]">
            {inputText}
            {inputText && <span className="inline-block w-px h-3 bg-brand-400 ml-0.5 animate-pulse" />}
            {!inputText && <span className="text-gray-600">Ask about your AWS environment…</span>}
          </span>
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] shrink-0 ${inputText ? "bg-brand-500 text-white" : "bg-white/[0.06] text-gray-600"}`}>→</div>
        </div>
      </div>
    </div>
  );
}

function Thumbnail({ onClick }: { onClick: () => void }) {
  return (
    <div className="absolute inset-0 cursor-pointer group" onClick={onClick}>
      <div className="absolute inset-0 flex flex-col opacity-60">
        <div className="shrink-0 border-b border-white/[0.06] bg-surface-card/40 px-4 py-2 flex items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <Cloud className="w-3 h-3 text-brand-400" />
            </div>
            <span className="text-xs font-semibold">CloudMind</span>
          </div>
        </div>
        <div className="shrink-0 border-b border-white/[0.06] bg-white/[0.01] px-3 flex items-center h-8">
          {["Chat", "How It Works"].map((tab, i) => (
            <div key={tab} className={`relative px-2.5 py-1 text-[9px] font-medium ${i === 0 ? "text-white" : "text-gray-600"}`}>
              {tab}
              {i === 0 && <span className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-brand-500 to-violet-400 rounded-t-full" />}
            </div>
          ))}
        </div>
        <div className="flex-1 px-4 py-3 space-y-2.5">
          <div className="flex gap-1.5 flex-row-reverse">
            <div className="w-5 h-5 rounded-lg bg-brand-500/30 flex items-center justify-center shrink-0"><User className="w-2.5 h-2.5 text-white" /></div>
            <div className="bg-brand-500 px-2.5 py-1.5 rounded-xl rounded-tr-sm text-[10px] text-white max-w-[70%]">How many EC2 instances do I have?</div>
          </div>
          <div className="flex gap-1.5">
            <div className="w-5 h-5 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0"><Cloud className="w-2.5 h-2.5 text-brand-400" /></div>
            <div className="bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 rounded-xl rounded-tl-sm text-[10px] text-gray-300 max-w-[70%]">You have <strong className="text-white">4 EC2 instances</strong> in us-east-1.</div>
          </div>
          <div className="flex gap-1.5 flex-row-reverse">
            <div className="w-5 h-5 rounded-lg bg-brand-500/30 flex items-center justify-center shrink-0"><User className="w-2.5 h-2.5 text-white" /></div>
            <div className="bg-brand-500 px-2.5 py-1.5 rounded-xl rounded-tr-sm text-[10px] text-white max-w-[70%]">Which security groups allow inbound 0.0.0.0/0?</div>
          </div>
          <div className="flex gap-1.5">
            <div className="w-5 h-5 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0"><Cloud className="w-2.5 h-2.5 text-brand-400" /></div>
            <div className="bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 rounded-xl rounded-tl-sm text-[10px] text-gray-300 max-w-[70%]">⚠️ <strong className="text-white">web-tier-sg</strong> — ports 80 & 443 open to 0.0.0.0/0.</div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] group-hover:bg-black/50 transition-colors">
        <div className="w-16 h-16 rounded-full bg-white/15 border border-white/25 flex items-center justify-center group-hover:bg-white/25 group-hover:scale-105 transition-all duration-200 shadow-2xl mb-3">
          <Play className="w-6 h-6 fill-white text-white ml-1" />
        </div>
        <div className="text-center">
          <p className="text-white text-sm font-semibold">Watch demo</p>
          <p className="text-gray-400 text-xs mt-0.5">0:{TOTAL} · EC2 count → Security audit</p>
        </div>
      </div>
    </div>
  );
}

export function DemoVideo() {
  const [playing, setPlaying] = useState(false);
  const [time, setTime]       = useState(0);
  const [started, setStarted] = useState(false);
  const rafRef  = useRef<number>();
  const lastRef = useRef<number>();

  const tick = useCallback((now: number) => {
    if (!lastRef.current) lastRef.current = now;
    const delta = (now - lastRef.current) / 1000;
    lastRef.current = now;
    setTime(t => {
      const next = t + delta;
      if (next >= TOTAL) { setPlaying(false); return TOTAL; }
      return next;
    });
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (playing) {
      lastRef.current = undefined;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, tick]);

  const handlePlay = () => {
    if (!started) setStarted(true);
    if (time >= TOTAL) setTime(0);
    setPlaying(true);
  };

  const progress = Math.min(100, (time / TOTAL) * 100);
  const isDone   = time >= TOTAL;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/[0.1] shadow-2xl shadow-black/60">
      <div className="relative bg-surface" style={{ aspectRatio: "16/9" }}>
        {!started ? (
          <Thumbnail onClick={handlePlay} />
        ) : (
          <ChatScene t={time} />
        )}

        {started && !playing && !isDone && (
          <button onClick={handlePlay} className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
            <div className="w-14 h-14 rounded-full bg-white/15 border border-white/25 flex items-center justify-center hover:bg-white/25 transition-colors">
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            </div>
          </button>
        )}

        {isDone && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm gap-4">
            <div className="text-center">
              <p className="text-white font-semibold mb-1">Demo complete</p>
              <p className="text-gray-400 text-sm">You just saw a full CloudMind session</p>
            </div>
            <button
              onClick={() => { setTime(0); setPlaying(true); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Watch again
            </button>
          </div>
        )}
      </div>

      <div className="bg-black/70 backdrop-blur-sm px-4 pt-2 pb-3">
        <div
          className="h-1 bg-white/10 rounded-full mb-2.5 cursor-pointer group relative"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const t = ((e.clientX - r.left) / r.width) * TOTAL;
            setTime(Math.max(0, Math.min(TOTAL, t)));
            if (!started) setStarted(true);
          }}
        >
          <div className="h-full bg-brand-500 rounded-full relative group-hover:bg-brand-400 transition-colors" style={{ width: `${progress}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={playing ? () => setPlaying(false) : handlePlay} className="text-white hover:text-brand-400 transition-colors">
            {playing ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
          </button>
          <button onClick={() => { setTime(0); setPlaying(false); setStarted(false); }} className="text-gray-600 hover:text-white transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-gray-500">{fmt(time)} / {fmt(TOTAL)}</span>
          <div className="flex-1" />
          <span className="text-[10px] uppercase tracking-widest text-gray-700 font-medium">CloudMind · Demo</span>
        </div>
      </div>
    </div>
  );
}
