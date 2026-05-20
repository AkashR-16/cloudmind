"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Cloud, User } from "lucide-react";

const TOTAL = 52;

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

// ── LOGIN SCENE (t: 0 → 9) ─────────────────────────────
const EMAIL_TEXT = "demo@cloudmind.ai";
const PASS_TEXT  = "•••••••••••";

function LoginScene({ t }: { t: number }) {
  const email    = charsAt(t, 0.8, 3.5, EMAIL_TEXT);
  const pass     = charsAt(t, 4.2, 6.8, PASS_TEXT);
  const loading  = t >= 7 && t < 8.5;
  const fadeOut  = t >= 8.5 ? Math.max(0, 1 - (t - 8.5) * 3) : 1;
  const emailCursor = t >= 0.8 && t < 3.5;
  const passCursor  = t >= 4.2 && t < 6.8;

  return (
    <div className="absolute inset-0 flex" style={{ opacity: fadeOut }}>
      {/* Left branding panel */}
      <div className="w-[44%] h-full bg-surface-card border-r border-white/[0.05] flex flex-col justify-between p-6 relative overflow-hidden">
        <div className="absolute w-48 h-48 rounded-full bg-brand-500/8 -top-12 -left-12 blur-3xl" />
        {/* Logo */}
        <div className="flex items-center gap-1.5 relative">
          <div className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
            <Cloud className="w-3 h-3 text-brand-400" />
          </div>
          <span className="text-xs font-semibold">CloudMind</span>
        </div>
        {/* Pitch */}
        <div className="space-y-3 relative">
          <h2 className="text-sm font-bold leading-snug">
            Your AWS environment,
            <br />
            <span className="bg-gradient-to-r from-brand-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              answered instantly.
            </span>
          </h2>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Ask about EC2 instances, S3 buckets, VPCs, IAM roles, and more — all in plain English.
          </p>
        </div>
        {/* Demo bubble */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 space-y-1.5 relative">
          <div className="flex justify-end">
            <div className="bg-brand-500 text-white text-[9px] px-2 py-1 rounded-xl rounded-tr-sm max-w-[85%]">
              How many EC2s are running?
            </div>
          </div>
          <div className="flex justify-start">
            <div className="bg-white/[0.04] border border-white/[0.08] text-gray-300 text-[9px] px-2 py-1 rounded-xl rounded-tl-sm max-w-[85%]">
              Found <strong className="text-white">3 running</strong> — web-server-01, api-server-01, worker-node-1.
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-[200px] space-y-4">
          <div>
            <h3 className="text-sm font-bold mb-0.5">Welcome back</h3>
            <p className="text-[10px] text-gray-500">Sign in to your workspace</p>
          </div>
          <div className="space-y-2.5">
            {/* Email */}
            <div>
              <label className="text-[9px] text-gray-500 uppercase tracking-wider mb-1 block">Email</label>
              <div className="w-full bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-[10px] text-white flex items-center min-h-[26px]">
                <span>{email}</span>
                {emailCursor && <span className="ml-0.5 inline-block w-px h-3 bg-brand-400 animate-pulse" />}
              </div>
            </div>
            {/* Password */}
            <div>
              <label className="text-[9px] text-gray-500 uppercase tracking-wider mb-1 block">Password</label>
              <div className="w-full bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-[10px] text-white flex items-center min-h-[26px]">
                <span>{pass}</span>
                {passCursor && <span className="ml-0.5 inline-block w-px h-3 bg-brand-400 animate-pulse" />}
              </div>
            </div>
            {/* Button */}
            <button className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold text-white ${loading ? "bg-brand-600" : "bg-brand-500"}`}>
              {loading
                ? <><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />Signing in…</>
                : "Sign in →"}
            </button>
          </div>
          <p className="text-center text-[9px] text-gray-700">Local demo — any credentials work</p>
        </div>
      </div>
    </div>
  );
}

// ── CHAT SCENE (t: 9 → 52) ─────────────────────────────
const Q1   = "How many EC2 instances do I have?";
const A1   = "You have **4 EC2 instances** in us-east-1 (all currently terminated):\n• **web-server-01** (t3.medium)\n• **api-server-01** (t3.large)\n• **worker-node-1** (t3.small)\n• **worker-node-2** (t3.small)";
const Q2   = "Which security groups allow inbound 0.0.0.0/0?";
const A2   = "⚠️ **Security alert** — **web-tier-sg** allows unrestricted inbound traffic:\n\n• Port **80** (HTTP) from 0.0.0.0/0\n• Port **443** (HTTPS) from 0.0.0.0/0\n\nVerify this is intentional for public-facing services.";

function TypingDots() {
  return (
    <div className="flex gap-1 items-center px-2.5 py-2">
      {[0, 0.2, 0.4].map((d, i) => (
        <div key={i} className="w-1 h-1 rounded-full bg-gray-500 animate-typing" style={{ animationDelay: `${d}s` }} />
      ))}
    </div>
  );
}

function ChatScene({ t }: { t: number }) {
  const fadeIn = t < 10 ? Math.min(1, (t - 9) * 3) : 1;

  // What the input bar shows
  const inputText =
    t < 11 ? ""
    : t < 17 ? charsAt(t, 11, 17, Q1)
    : t < 18.5 ? ""
    : t < 27 ? charsAt(t, 18.5, 27, Q2)
    : "";

  const showQ1       = t >= 17;
  const typingA1     = t >= 17 && t < 18;
  const a1Text       = t >= 18 && t < 18.5 ? "" : t >= 18.5 ? charsAt(t, 18.5, 28, A1) : "";
  const a1Streaming  = a1Text.length > 0 && a1Text.length < A1.length;

  const showQ2       = t >= 28;
  const typingA2     = t >= 28 && t < 29;
  const a2Text       = t >= 29 ? charsAt(t, 29, 50, A2) : "";
  const a2Streaming  = a2Text.length > 0 && a2Text.length < A2.length;

  const showEmpty    = !showQ1 && t >= 10;

  return (
    <div className="absolute inset-0 flex flex-col" style={{ opacity: fadeIn }}>
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] bg-surface-card/40 backdrop-blur-xl px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
            <Cloud className="w-3 h-3 text-brand-400" />
          </div>
          <span className="text-xs font-semibold">CloudMind</span>
        </div>
        <div className="w-6 h-6 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
          <User className="w-3 h-3 text-brand-400" />
        </div>
      </div>

      {/* Nav tabs */}
      <div className="shrink-0 border-b border-white/[0.06] bg-white/[0.01] px-3 flex items-center gap-0.5 h-8">
        {["Chat", "How It Works", "Infrastructure", "Settings"].map((tab, i) => (
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
          {/* Q1 */}
          {showQ1 && (
            <div className="flex gap-1.5 flex-row-reverse items-end">
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shrink-0">
                <User className="w-2.5 h-2.5 text-white" />
              </div>
              <div className="max-w-[78%] bg-gradient-to-br from-brand-500 to-brand-600 px-2.5 py-1.5 rounded-xl rounded-tr-sm text-[10px] text-white">{Q1}</div>
            </div>
          )}

          {/* A1 */}
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

          {/* Q2 */}
          {showQ2 && (
            <div className="flex gap-1.5 flex-row-reverse items-end">
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shrink-0">
                <User className="w-2.5 h-2.5 text-white" />
              </div>
              <div className="max-w-[78%] bg-gradient-to-br from-brand-500 to-brand-600 px-2.5 py-1.5 rounded-xl rounded-tr-sm text-[10px] text-white">{Q2}</div>
            </div>
          )}

          {/* A2 */}
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

// ── THUMBNAIL ───────────────────────────────────────────
function Thumbnail({ onClick }: { onClick: () => void }) {
  return (
    <div className="absolute inset-0 cursor-pointer group" onClick={onClick}>
      {/* Static chat preview */}
      <div className="absolute inset-0 flex flex-col opacity-60">
        <div className="shrink-0 border-b border-white/[0.06] bg-surface-card/40 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <Cloud className="w-3 h-3 text-brand-400" />
            </div>
            <span className="text-xs font-semibold">CloudMind</span>
          </div>
        </div>
        <div className="shrink-0 border-b border-white/[0.06] bg-white/[0.01] px-3 flex items-center h-8">
          {["Chat", "How It Works", "Infrastructure", "Settings"].map((tab, i) => (
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
            <div className="bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 rounded-xl rounded-tl-sm text-[10px] text-gray-300 max-w-[70%]">You have <strong className="text-white">4 EC2 instances</strong> in us-east-1 (all terminated).</div>
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

      {/* Play overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] group-hover:bg-black/50 transition-colors">
        <div className="w-16 h-16 rounded-full bg-white/15 border border-white/25 flex items-center justify-center group-hover:bg-white/25 group-hover:scale-105 transition-all duration-200 shadow-2xl mb-3">
          <Play className="w-6 h-6 fill-white text-white ml-1" />
        </div>
        <div className="text-center">
          <p className="text-white text-sm font-semibold">Watch demo</p>
          <p className="text-gray-400 text-xs mt-0.5">0:{TOTAL} · Sign in → EC2 count → Security audit</p>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ──────────────────────────────────────
export function DemoVideo() {
  const [playing, setPlaying]   = useState(false);
  const [time, setTime]         = useState(0);
  const [started, setStarted]   = useState(false);
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
  const isDone = time >= TOTAL;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/[0.1] shadow-2xl shadow-black/60">
      {/* Screen */}
      <div className="relative bg-surface" style={{ aspectRatio: "16/9" }}>
        {!started ? (
          <Thumbnail onClick={handlePlay} />
        ) : (
          <>
            {time < 9.5 && <LoginScene t={time} />}
            {time >= 9 && <ChatScene t={time} />}
          </>
        )}

        {/* Paused overlay */}
        {started && !playing && !isDone && (
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]"
          >
            <div className="w-14 h-14 rounded-full bg-white/15 border border-white/25 flex items-center justify-center hover:bg-white/25 transition-colors">
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            </div>
          </button>
        )}

        {/* Done overlay */}
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

      {/* Controls bar */}
      <div className="bg-black/70 backdrop-blur-sm px-4 pt-2 pb-3">
        {/* Progress */}
        <div
          className="h-1 bg-white/10 rounded-full mb-2.5 cursor-pointer group relative"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const t = ((e.clientX - r.left) / r.width) * TOTAL;
            setTime(Math.max(0, Math.min(TOTAL, t)));
            if (!started) setStarted(true);
          }}
        >
          <div
            className="h-full bg-brand-500 rounded-full relative group-hover:bg-brand-400 transition-colors"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Buttons + time */}
        <div className="flex items-center gap-3">
          <button
            onClick={playing ? () => setPlaying(false) : handlePlay}
            className="text-white hover:text-brand-400 transition-colors"
          >
            {playing
              ? <Pause className="w-4 h-4 fill-white" />
              : <Play className="w-4 h-4 fill-white ml-0.5" />}
          </button>
          <button
            onClick={() => { setTime(0); setPlaying(false); setStarted(false); }}
            className="text-gray-600 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-gray-500">
            {fmt(time)} / {fmt(TOTAL)}
          </span>
          <div className="flex-1" />
          <span className="text-[10px] uppercase tracking-widest text-gray-700 font-medium">CloudMind · Demo</span>
        </div>
      </div>
    </div>
  );
}
