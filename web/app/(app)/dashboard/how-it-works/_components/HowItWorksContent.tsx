"use client";

import { ArrowRight, Zap } from "lucide-react";
import { DemoVideo } from "./DemoVideo";

const FLOW_STEPS = [
  { label: "You ask",    desc: "\"Which security groups allow 0.0.0.0/0?\"", color: "#4f6ef7" },
  { label: "Intent",     desc: "Claude classifies → security_query",          color: "#8b5cf6" },
  { label: "AQL",        desc: "Claude generates + sanitizes query",           color: "#a855f7" },
  { label: "ArangoDB",   desc: "Executes against fix graph",                   color: "#06b6d4" },
  { label: "Synthesize", desc: "Claude streams answer with context",           color: "#22c55e" },
  { label: "You read",   desc: "web-tier-sg · ports 80, 443",                 color: "#4f6ef7" },
];

const TECH = [
  { label: "Floci",              sub: "Local AWS simulator"      },
  { label: "fixworker + fixcore", sub: "FixInventory discovery"  },
  { label: "ArangoDB",           sub: "Graph database"           },
  { label: "Claude Opus 4.7",    sub: "AI model"                 },
  { label: "FastAPI + Uvicorn",  sub: "Backend API"              },
  { label: "Upstash Redis",      sub: "Session store"            },
  { label: "Next.js 14",         sub: "Frontend"                 },
  { label: "Render + Vercel",    sub: "Hosting"                  },
];

export function HowItWorksContent() {
  return (
    <div className="h-[calc(100vh-7rem)] overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-14">

        {/* ── Header — 1 liner ── */}
        <div>
          <div className="badge mb-4">
            <Zap className="w-3 h-3" />
            Floci · ArangoDB · Claude · FastAPI · Next.js
          </div>
          <h1 className="text-3xl font-bold mb-3">How CloudMind works</h1>
          <p className="text-gray-400 text-base leading-relaxed max-w-2xl">
            You ask a question in plain English — Claude classifies it, writes an AQL graph query,
            runs it against your FixInventory-discovered AWS environment in ArangoDB, and streams
            back a precise answer in real time.
          </p>
        </div>

        {/* ── Demo walkthrough ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Demo walkthrough</h2>
          </div>
          <DemoVideo />
        </section>

        {/* ── Query flow ── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Query flow — one question, six hops</h2>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {FLOW_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="rounded-xl border px-3 py-2 bg-white/[0.02]" style={{ borderColor: `${step.color}30` }}>
                  <p className="text-[10px] font-semibold" style={{ color: step.color }}>{step.label}</p>
                  <p className="text-[9px] text-gray-500 max-w-[110px] leading-relaxed">{step.desc}</p>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-gray-700 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Tech stack ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tech stack</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TECH.map(({ label, sub }) => (
              <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <p className="text-xs font-semibold text-white">{label}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
