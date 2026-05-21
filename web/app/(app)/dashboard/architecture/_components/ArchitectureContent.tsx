"use client";

import { Network, ArrowDown, Cloud, Database, Cpu, Workflow, Boxes } from "lucide-react";

type ContainerCard = {
  name: string;
  port?: string;
  image: string;
  role: string;
  description: string;
  accent: string;
  border: string;
};

const CONTAINERS: ContainerCard[] = [
  {
    name: "floci",
    port: ":4566",
    image: "floci/floci",
    role: "AWS API simulator",
    description:
      "Implements 47 AWS service APIs (EC2, S3, IAM, RDS, Lambda, VPC, …) locally. The data source — no real AWS account required.",
    accent: "text-amber-300",
    border: "border-amber-500/30 bg-amber-500/[0.04]",
  },
  {
    name: "fixworker",
    image: "someengineering/fixworker",
    role: "Resource discovery",
    description:
      "Walks AWS APIs via boto3 with AWS_ENDPOINT_URL pointed at Floci. Streams discovered resources + relationships to fixcore.",
    accent: "text-violet-300",
    border: "border-violet-500/30 bg-violet-500/[0.04]",
  },
  {
    name: "fixcore",
    port: ":8900",
    image: "someengineering/fixcore",
    role: "Graph orchestrator",
    description:
      "FixInventory core. Schedules collections, normalizes resources into FixInventory's resource graph schema, writes to ArangoDB.",
    accent: "text-violet-300",
    border: "border-violet-500/30 bg-violet-500/[0.04]",
  },
  {
    name: "arangodb",
    port: ":8529",
    image: "arangodb:3.11",
    role: "Graph database",
    description:
      "Multi-model store. Holds the discovered AWS environment as a graph — vertices=resources, edges=parent/child relationships. Backend queries this via AQL.",
    accent: "text-cyan-300",
    border: "border-cyan-500/30 bg-cyan-500/[0.04]",
  },
  {
    name: "redis",
    port: ":6379",
    image: "redis:7-alpine",
    role: "Session context",
    description:
      "Holds rolling chat history per session so the agent has multi-turn context. TTL keeps memory bounded.",
    accent: "text-red-300",
    border: "border-red-500/30 bg-red-500/[0.04]",
  },
];

export function ArchitectureContent() {
  return (
    <div className="h-[calc(100vh-7rem)] overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-14">

        {/* ── Header ── */}
        <div>
          <div className="badge mb-4">
            <Network className="w-3 h-3" />
            5-container local stack
          </div>
          <h1 className="text-3xl font-bold mb-3">Architecture</h1>
          <p className="text-gray-400 text-base leading-relaxed max-w-2xl">
            CloudMind turns natural-language questions about your AWS environment into precise,
            grounded answers. It does this without touching real AWS — a local stack of five
            containers simulates AWS, discovers its resources into a graph database, and exposes
            them to an LLM-driven query pipeline.
          </p>
        </div>

        {/* ── Capability summary ── */}
        <section className="grid sm:grid-cols-3 gap-3">
          {[
            {
              icon: Cloud,
              title: "Zero-AWS demo",
              body: "Floci stands in for AWS — try the agent without real credentials or cloud cost.",
            },
            {
              icon: Workflow,
              title: "Real discovery pipeline",
              body: "fixworker + fixcore are the same components FixInventory uses in production.",
            },
            {
              icon: Cpu,
              title: "Grounded LLM answers",
              body: "Claude writes the graph query — answers cite resources that actually exist.",
            },
          ].map(({ icon: Icon, title, body }, i) => (
            <div
              key={i}
              className="rounded-2xl border border-surface-border/60 bg-surface-card/30 p-4"
            >
              <Icon className="w-4 h-4 text-brand-400 mb-2" />
              <p className="text-sm font-medium text-white">{title}</p>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </section>

        {/* ── Diagram ── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Data flow — from AWS sim to your answer
            </h2>
          </div>

          <div className="space-y-3">
            <DiagramLane
              tag="Source"
              accent="text-amber-300/80"
              cards={[
                {
                  name: "floci",
                  port: ":4566",
                  hint: "Simulates 47 AWS services",
                  accent: "border-amber-500/30 bg-amber-500/[0.05]",
                  nameColor: "text-amber-300",
                },
              ]}
            />

            <FlowArrow label="boto3 · AWS_ENDPOINT_URL" />

            <DiagramLane
              tag="Discovery"
              accent="text-violet-300/80"
              cards={[
                {
                  name: "fixworker",
                  hint: "boto3 walks every service",
                  accent: "border-violet-500/30 bg-violet-500/[0.05]",
                  nameColor: "text-violet-300",
                },
                {
                  name: "fixcore",
                  port: ":8900",
                  hint: "Normalize to graph schema",
                  accent: "border-violet-500/30 bg-violet-500/[0.05]",
                  nameColor: "text-violet-300",
                },
              ]}
            />

            <FlowArrow label="write resources + edges" />

            <DiagramLane
              tag="Storage"
              accent="text-cyan-300/80"
              cards={[
                {
                  name: "arangodb",
                  port: ":8529",
                  hint: "Graph DB · db=fix",
                  accent: "border-cyan-500/30 bg-cyan-500/[0.05]",
                  nameColor: "text-cyan-300",
                },
                {
                  name: "redis",
                  port: ":6379",
                  hint: "Per-session chat context",
                  accent: "border-red-500/30 bg-red-500/[0.05]",
                  nameColor: "text-red-300",
                },
              ]}
            />

            <FlowArrow label="AQL query · session lookup" />

            <DiagramLane
              tag="Application"
              accent="text-brand-300/80"
              cards={[
                {
                  name: "backend",
                  port: ":8000",
                  hint: "FastAPI · intent → AQL → synth",
                  accent: "border-brand-500/30 bg-brand-500/[0.06]",
                  nameColor: "text-brand-300",
                },
                {
                  name: "Claude",
                  hint: "Local CLI or API key",
                  accent: "border-emerald-500/30 bg-emerald-500/[0.05]",
                  nameColor: "text-emerald-300",
                },
                {
                  name: "frontend",
                  port: ":3000",
                  hint: "Next.js · this UI",
                  accent: "border-brand-500/30 bg-brand-500/[0.06]",
                  nameColor: "text-brand-300",
                },
              ]}
            />
          </div>
        </section>

        {/* ── Container reference ── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              The 5 containers — what each one does
            </h2>
          </div>

          <div className="space-y-3">
            {CONTAINERS.map((c) => (
              <div
                key={c.name}
                className={`rounded-2xl border ${c.border} p-4 sm:p-5`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                  <Boxes className={`w-4 h-4 ${c.accent} shrink-0`} />
                  <span className={`font-mono text-sm font-semibold ${c.accent}`}>
                    {c.name}
                  </span>
                  {c.port && (
                    <span className="text-[11px] font-mono text-gray-500">{c.port}</span>
                  )}
                  <span className="text-[11px] text-gray-500">·</span>
                  <span className="text-xs text-gray-400">{c.role}</span>
                  <span className="ml-auto text-[10px] font-mono text-gray-600">
                    {c.image}
                  </span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{c.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── End-to-end blurb ── */}
        <section className="rounded-2xl border border-surface-border/60 bg-surface-card/30 p-5">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-brand-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium mb-1">End-to-end in one paragraph</p>
              <p className="text-sm text-gray-400 leading-relaxed">
                Floci pretends to be AWS. fixworker discovers everything floci is hosting and
                pipes it to fixcore, which writes it into ArangoDB as a graph. When you ask a
                question, the FastAPI backend asks Claude to classify intent and write an AQL
                query, runs it against ArangoDB, and streams a synthesized answer back. Redis
                keeps your last few turns of chat history so follow-up questions have context.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── diagram primitives ─────────────────────────────────────────────────────

type DiagramCard = {
  name: string;
  port?: string;
  hint: string;
  accent: string;
  nameColor: string;
};

function DiagramLane({
  tag,
  accent,
  cards,
}: {
  tag: string;
  accent: string;
  cards: DiagramCard[];
}) {
  return (
    <div className="rounded-2xl border border-surface-border/60 bg-surface-card/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] uppercase tracking-wider font-semibold ${accent}`}>
          {tag}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.name}
            className={`rounded-xl border ${c.accent} px-3 py-2.5`}
          >
            <div className="flex items-baseline gap-2">
              <span className={`font-mono text-sm font-semibold ${c.nameColor}`}>
                {c.name}
              </span>
              {c.port && (
                <span className="text-[10px] font-mono text-gray-500">{c.port}</span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-500 leading-snug">{c.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      <ArrowDown className="w-3.5 h-3.5 text-gray-600" />
      <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">
        {label}
      </span>
    </div>
  );
}
