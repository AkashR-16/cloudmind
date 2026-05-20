"use client";

import { Server, Database, Brain, MessageSquare, Zap } from "lucide-react";
import { DemoVideo } from "./DemoVideo";
import { SandboxDemo } from "./SandboxDemo";

const PIPELINE = [
  {
    icon: Server,
    num: 1,
    label: "Floci",
    desc: "Simulates real AWS APIs locally — EC2, S3, VPC, IAM, RDS. No account needed.",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
  },
  {
    icon: Database,
    num: 2,
    label: "FixInventory",
    desc: "Scans Floci and maps every resource and relationship into ArangoDB as a graph.",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: Brain,
    num: 3,
    label: "Gemini AI",
    desc: "Classifies your question, generates an AQL graph query, executes it, and synthesizes an answer.",
    color: "text-brand-400",
    bg: "bg-brand-500/10 border-brand-500/20",
  },
  {
    icon: MessageSquare,
    num: 4,
    label: "CloudMind",
    desc: "Streams the answer back token-by-token with full conversation context for follow-ups.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
];

export function HowItWorksContent() {
  return (
    <div className="h-[calc(100vh-7rem)] overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-14">

        {/* ── Header ── */}
        <div>
          <div className="badge mb-4">
            <Zap className="w-3 h-3" />
            Gemini AI · FixInventory · ArangoDB
          </div>
          <h1 className="text-3xl font-bold mb-2">How CloudMind works</h1>
          <p className="text-gray-500 text-sm max-w-xl">
            Watch a real walkthrough — sign in, ask about your infrastructure, and see the AI answer in real time.
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
            Animated walkthrough · Sign in → Ask questions → Get instant answers · 0:52
          </p>
        </section>

        {/* ── Pipeline ── */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">The 4-step pipeline</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {PIPELINE.map((step) => (
              <div
                key={step.num}
                className={`rounded-2xl border p-5 ${step.bg} flex gap-4`}
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${step.bg}`}>
                  <step.icon className={`w-5 h-5 ${step.color}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${step.color}`}>Step {step.num}</span>
                    <span className="text-sm font-semibold text-white">{step.label}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{step.desc}</p>
                </div>
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
            Connected to the real FixInventory graph. Ask anything about the discovered AWS resources.
          </p>
          <SandboxDemo />
        </section>

      </div>
    </div>
  );
}
