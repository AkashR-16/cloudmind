"use client";

import {
  Server, Database, Brain, MessageSquare, Zap, Cloud,
  GitBranch, Key, Globe, ArrowRight, Shield,
} from "lucide-react";
import { DemoVideo } from "./DemoVideo";
import { SandboxDemo } from "./SandboxDemo";

// ── Full architecture pipeline ───────────────────────────────
const ARCH = [
  {
    group: "Data Layer",
    color: "#f97316",
    items: [
      {
        icon: Server,
        label: "Floci",
        sublabel: "localhost:4566",
        desc: "Runs as a Docker container, simulating 47 real AWS APIs (EC2, S3, VPC, IAM, RDS, Lambda) locally. No real AWS account needed.",
      },
      {
        icon: GitBranch,
        label: "fixworker",
        sublabel: "FixInventory · AWS_ENDPOINT_URL",
        desc: "FixInventory's collector runs in Docker, pointed at Floci via AWS_ENDPOINT_URL=http://floci:4566. Uses fake credentials — never contacts real AWS.",
      },
      {
        icon: Shield,
        label: "fixcore",
        sublabel: "FixInventory · :8900",
        desc: "FixInventory's graph API orchestrates collection. Receives resource data from fixworker and writes it to ArangoDB using FixInventory's native schema.",
      },
      {
        icon: Database,
        label: "ArangoDB",
        sublabel: "db=fix · vertices=fix · edges=fix_default",
        desc: "Stores the FixInventory resource graph. Each AWS resource is a vertex; relationships (VPC→Subnet→EC2) are directed edges. Queried via AQL.",
      },
    ],
  },
  {
    group: "Intelligence Layer",
    color: "#4f6ef7",
    items: [
      {
        icon: Brain,
        label: "Gemini 3.1 Flash Lite",
        sublabel: "Intent · AQL · Synthesis",
        desc: "Three roles: (1) classifies question intent, (2) generates a safe AQL graph query, (3) synthesises the answer from raw results.",
      },
      {
        icon: Shield,
        label: "AQL Safety",
        sublabel: "validate + sanitize",
        desc: "Write operations (REMOVE/INSERT/UPDATE) are blocked. Malformed nested-array patterns are auto-corrected before hitting the database.",
      },
    ],
  },
  {
    group: "API Layer",
    color: "#22c55e",
    items: [
      {
        icon: Key,
        label: "Redis (Upstash)",
        sublabel: "Session context · TLS",
        desc: "Stores per-session conversation history (up to 10 turns, 24 h TTL). Enables follow-up questions like 'what types are they?'",
      },
      {
        icon: Cloud,
        label: "FastAPI",
        sublabel: "Render · cloudmind-onax",
        desc: "Streaming backend — intent → AQL → DB execute → Gemini synthesis → token-by-token StreamingResponse. Cold starts ~30 s on free tier.",
      },
    ],
  },
  {
    group: "Frontend Layer",
    color: "#a855f7",
    items: [
      {
        icon: Globe,
        label: "Next.js + React",
        sublabel: "Vercel · cloudmind-coral",
        desc: "Chat interface with streaming token rendering, infrastructure graph (ReactFlow), and this page. Rewrites /api/* to Render.",
      },
      {
        icon: MessageSquare,
        label: "CloudMind UI",
        sublabel: "Chat · Graph · How It Works",
        desc: "Ask questions in plain English. Answers stream in real time. Infrastructure tab shows the live resource graph. Sessions persist across messages.",
      },
    ],
  },
];

const FLOW_STEPS = [
  { label: "You ask", desc: "\"Which security groups allow 0.0.0.0/0?\"", color: "#4f6ef7" },
  { label: "Intent", desc: "Gemini classifies → security_query", color: "#8b5cf6" },
  { label: "AQL", desc: "Gemini generates + sanitizes query", color: "#a855f7" },
  { label: "ArangoDB", desc: "Executes against fix graph", color: "#06b6d4" },
  { label: "Synthesize", desc: "Gemini streams answer with context", color: "#22c55e" },
  { label: "You read", desc: "web-tier-sg · ports 80, 443", color: "#4f6ef7" },
];

export function HowItWorksContent() {
  return (
    <div className="h-[calc(100vh-7rem)] overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-14">

        {/* ── Header ── */}
        <div>
          <div className="badge mb-4">
            <Zap className="w-3 h-3" />
            Floci · fixworker · fixcore · ArangoDB · Gemini · FastAPI · Next.js
          </div>
          <h1 className="text-3xl font-bold mb-2">How CloudMind works</h1>
          <p className="text-gray-500 text-sm max-w-xl">
            FixInventory discovers your AWS environment from Floci (a local AWS simulator),
            persists it as a graph in ArangoDB, and a Gemini-powered AI agent answers
            questions in plain English — with memory for follow-ups.
          </p>
        </div>

        {/* ── Demo Video ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Demo walkthrough</h2>
          </div>
          <DemoVideo />
          <p className="text-xs text-gray-600 mt-3 text-center">
            Animated walkthrough · Sign in → Ask about EC2 → Security group audit · 0:52
          </p>
        </section>

        {/* ── Request flow ── */}
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

        {/* ── Full architecture ── */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Full architecture</h2>
          </div>
          <div className="space-y-6">
            {ARCH.map((group) => (
              <div key={group.group}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 rounded" style={{ background: `${group.color}30` }} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest px-2" style={{ color: group.color }}>
                    {group.group}
                  </span>
                  <div className="h-px flex-1 rounded" style={{ background: `${group.color}30` }} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {group.items.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border p-4 flex gap-3"
                      style={{ background: `${group.color}06`, borderColor: `${group.color}20` }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${group.color}15`, border: `1px solid ${group.color}30` }}
                      >
                        <item.icon className="w-4 h-4" style={{ color: group.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-white">{item.label}</span>
                          <span className="text-[9px] font-mono text-gray-600 bg-white/[0.04] px-1.5 py-0.5 rounded">{item.sublabel}</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Discovery pipeline ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Discovery pipeline — Floci → FixInventory → ArangoDB</h2>
          </div>
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.03] p-4 space-y-3 text-xs font-mono text-gray-400">
            <div className="flex items-start gap-3">
              <span className="text-orange-400 shrink-0">1.</span>
              <span><span className="text-white">Floci</span> starts as a Docker container on <span className="text-orange-300">:4566</span> — simulates EC2, S3, VPC, IAM, RDS, Lambda locally</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-orange-400 shrink-0">2.</span>
              <span><span className="text-white">seed_floci.py</span> creates 20+ AWS resources inside Floci using boto3 pointed at localhost:4566</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-orange-400 shrink-0">3.</span>
              <span><span className="text-white">fixworker</span> (FixInventory) starts with <span className="text-orange-300">AWS_ENDPOINT_URL=http://floci:4566</span> — all boto3 calls hit Floci, never real AWS</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-orange-400 shrink-0">4.</span>
              <span><span className="text-white">fixworker</span> discovers every resource and relationship, sends them to <span className="text-white">fixcore</span> over a secure PSK-authenticated channel</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-orange-400 shrink-0">5.</span>
              <span><span className="text-white">fixcore</span> writes the graph to ArangoDB: <span className="text-orange-300">db=fix</span>, vertices=<span className="text-orange-300">fix</span>, edges=<span className="text-orange-300">fix_default</span></span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-orange-400 shrink-0">6.</span>
              <span>FastAPI agent queries ArangoDB via AQL and answers questions in plain English using Gemini</span>
            </div>
          </div>
        </section>

        {/* ── Tech stack ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tech stack</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Floci", sub: "Local AWS simulator" },
              { label: "fixworker + fixcore", sub: "FixInventory discovery" },
              { label: "ArangoDB", sub: "Graph database" },
              { label: "Gemini 3.1 Flash Lite", sub: "AI model" },
              { label: "FastAPI + Uvicorn", sub: "Backend API" },
              { label: "Upstash Redis", sub: "Session store" },
              { label: "Next.js 14", sub: "Frontend" },
              { label: "Render + Vercel", sub: "Hosting" },
            ].map(({ label, sub }) => (
              <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <p className="text-xs font-semibold text-white">{label}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Live sandbox ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Try it live</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Connected to the real FixInventory graph. 26 resources, 15 edges. Ask anything.
          </p>
          <SandboxDemo />
        </section>

      </div>
    </div>
  );
}
