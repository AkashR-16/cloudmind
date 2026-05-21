import Link from "next/link";
import {
  Cloud, MessageSquare, Database, Zap, Shield, ArrowRight,
  GitBranch, Lock, ChevronRight, Server, Network,
} from "lucide-react";

const STATS = [
  { value: "16", label: "Resource types" },
  { value: "<1s", label: "Query time" },
  { value: "4-step", label: "AI pipeline" },
  { value: "100%", label: "Local data" },
];

const FEATURES = [
  {
    icon: MessageSquare,
    label: "Natural Language",
    title: "Ask in plain English",
    description: "No AQL, no SQL, no query language. Just describe what you want to know about your infrastructure.",
    gradient: "from-brand-500/20 to-violet-500/20",
    border: "border-brand-500/20",
    iconBg: "bg-brand-500/15 border-brand-500/25",
    iconColor: "text-brand-400",
  },
  {
    icon: Database,
    label: "Graph Intelligence",
    title: "Relationships, not just lists",
    description: "Powered by ArangoDB's graph model — understands that EC2s live in subnets, subnets belong to VPCs.",
    gradient: "from-violet-500/20 to-purple-500/20",
    border: "border-violet-500/20",
    iconBg: "bg-violet-500/15 border-violet-500/25",
    iconColor: "text-violet-400",
  },
  {
    icon: Zap,
    label: "Streaming",
    title: "Answers in real time",
    description: "Responses stream token-by-token via Claude AI. No 10-second loading screens, no waiting.",
    gradient: "from-amber-500/15 to-orange-500/15",
    border: "border-amber-500/20",
    iconBg: "bg-amber-500/15 border-amber-500/25",
    iconColor: "text-amber-400",
  },
  {
    icon: Shield,
    label: "Security",
    title: "Proactive risk flagging",
    description: "Surfaces public S3 buckets, 0.0.0.0/0 ingress rules, and overly permissive IAM policies automatically.",
    gradient: "from-emerald-500/15 to-green-500/15",
    border: "border-emerald-500/20",
    iconBg: "bg-emerald-500/15 border-emerald-500/25",
    iconColor: "text-emerald-400",
  },
  {
    icon: GitBranch,
    label: "Context",
    title: "Follow-up questions work",
    description: "Ask 'which EC2s are running?' then 'which have public IPs?' — CloudMind maintains the conversation.",
    gradient: "from-rose-500/15 to-pink-500/15",
    border: "border-rose-500/20",
    iconBg: "bg-rose-500/15 border-rose-500/25",
    iconColor: "text-rose-400",
  },
  {
    icon: Lock,
    label: "Local",
    title: "Runs entirely on your machine",
    description: "No cloud uploads. Your infrastructure data stays on localhost via Floci + FixInventory.",
    gradient: "from-cyan-500/15 to-sky-500/15",
    border: "border-cyan-500/20",
    iconBg: "bg-cyan-500/15 border-cyan-500/25",
    iconColor: "text-cyan-400",
  },
];

const PIPELINE = [
  { icon: Server, label: "Floci", desc: "Simulates AWS locally", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  { icon: Database, label: "FixInventory", desc: "Graphs resources in ArangoDB", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  { icon: Cloud, label: "Claude AI", desc: "Generates AQL + answer", color: "text-brand-400", bg: "bg-brand-500/10 border-brand-500/20" },
  { icon: MessageSquare, label: "CloudMind", desc: "Streams to you", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
];

const DEMO_MESSAGES = [
  { role: "user",      text: "Which EC2 instances are currently running?" },
  { role: "assistant", text: "Found **3 running** EC2 instances in us-east-1:\n- **web-server-01** (t3.medium) · i-001\n- **api-server-01** (t3.large) · i-002\n- **worker-node-1** (t3.small) · i-003" },
  { role: "user",      text: "Are any S3 buckets public?" },
  { role: "assistant", text: "⚠️ Yes — **my-app-assets** has public access enabled. Block Public Access is not configured. Recommend reviewing the bucket policy immediately." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      {/* ── Top announcement bar ── */}
      <div className="relative z-20 border-b border-white/[0.04] bg-surface-card/50 backdrop-blur-sm px-4 py-2 text-center">
        <span className="text-xs text-gray-500">
          CloudMind is a local-first AI agent for AWS infrastructure exploration ·{" "}
          <Link href="/dashboard/how-it-works" className="text-brand-400 hover:text-brand-300 transition-colors inline-flex items-center gap-0.5">
            See how it works <ChevronRight className="w-3 h-3" />
          </Link>
        </span>
      </div>

      {/* ── Nav ── */}
      <nav className="relative z-10 border-b border-white/[0.05] backdrop-blur-xl bg-surface/80 sticky top-0 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shadow-glow-brand">
              <Cloud className="text-brand-400 w-4 h-4" />
            </div>
            <span className="font-semibold text-sm tracking-tight">CloudMind</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/chat" className="btn-primary text-sm py-2 px-4 rounded-xl">
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-16 px-6">
        {/* Background */}
        <div className="orb w-[700px] h-[700px] bg-brand-500/7 -top-48 left-1/2 -translate-x-1/2" />
        <div className="orb w-[400px] h-[400px] bg-violet-500/5 top-20 -left-20" />
        <div className="orb w-[350px] h-[350px] bg-purple-500/5 top-32 -right-20" />
        <div className="absolute inset-0 grid-bg opacity-30" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="badge mb-6 text-xs px-4 py-1.5">
            <Zap className="w-3 h-3" />
            Claude AI · FixInventory · ArangoDB · Real-time streaming
          </div>

          <h1 className="text-5xl md:text-[68px] font-bold leading-[1.05] mb-5 tracking-tight">
            Ask anything about your
            <br />
            <span className="text-gradient">AWS infrastructure.</span>
          </h1>

          <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
            CloudMind connects to your infrastructure graph and answers questions
            in plain English — with full context for follow-up questions.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-16">
            <Link href="/dashboard/chat" className="btn-primary px-6 py-3 text-base rounded-xl">
              Open CloudMind <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/dashboard/how-it-works" className="btn-ghost px-6 py-3 text-base rounded-xl">
              See how it works
            </Link>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-0 flex-wrap border border-white/[0.07] rounded-2xl bg-white/[0.02] backdrop-blur-sm divide-x divide-white/[0.07] overflow-hidden max-w-xl mx-auto">
            {STATS.map((s) => (
              <div key={s.label} className="flex-1 px-6 py-4 text-center min-w-[100px]">
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo terminal ── */}
      <section className="pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="card-glass overflow-hidden">
            {/* Chrome */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="flex-1 flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-gray-600 font-mono">cloudmind · chat</span>
              </div>
              <div className="w-16" />
            </div>
            {/* Messages */}
            <div className="p-6 space-y-4">
              {DEMO_MESSAGES.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} animate-fade-in`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Cloud className="w-3.5 h-3.5 text-brand-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-tr-sm shadow-lg shadow-brand-500/20"
                        : "bg-white/[0.04] border border-white/[0.08] text-gray-200 rounded-tl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {/* Typing indicator */}
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
                  <Cloud className="w-3.5 h-3.5 text-brand-400" />
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-typing" style={{ animationDelay: `${delay}s` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pipeline ── */}
      <section className="pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-2">How it works</h2>
            <p className="text-gray-500 text-sm">A 4-step pipeline from simulation to natural language answer</p>
          </div>
          <div className="flex items-center justify-center gap-0 flex-wrap">
            {PIPELINE.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center gap-3 px-4 sm:px-6 py-4">
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${step.bg}`}>
                    <step.icon className={`w-5 h-5 ${step.color}`} />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-white">{step.label}</div>
                    <div className="text-xs text-gray-600 mt-0.5 max-w-[100px]">{step.desc}</div>
                  </div>
                </div>
                {i < PIPELINE.length - 1 && (
                  <div className="text-gray-700 text-xl self-start mt-6 hidden sm:block">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="pb-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl font-bold mb-3">Everything you need to understand your cloud</h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              One interface. Real-time graph data. AI that actually understands infrastructure relationships.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`relative group rounded-2xl border ${f.border} bg-gradient-to-br ${f.gradient} p-5 overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-black/25`}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 shimmer transition-opacity duration-500 rounded-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${f.iconBg}`}>
                      <f.icon className={`w-4.5 h-4.5 ${f.iconColor}`} />
                    </div>
                    <span className={`text-xs font-semibold ${f.iconColor} uppercase tracking-wider`}>{f.label}</span>
                  </div>
                  <h3 className="font-semibold text-white text-base mb-2">{f.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="pb-28 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden border border-brand-500/20 bg-gradient-to-br from-brand-500/10 via-surface-card to-violet-500/10 p-12 text-center">
            <div className="orb w-72 h-72 bg-brand-500/12 -top-10 left-1/2 -translate-x-1/2" />
            <div className="absolute inset-0 grid-bg opacity-20" />
            <div className="relative">
              <div className="badge mb-5 mx-auto w-fit">
                <Cloud className="w-3 h-3" />
                Ready to explore
              </div>
              <h2 className="text-2xl font-bold mb-3">
                Ask your first question.
              </h2>
              <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
                Ask questions about your AWS infrastructure.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link href="/dashboard/chat" className="btn-primary inline-flex px-6 py-3 text-base rounded-xl">
                  Open CloudMind <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.04] py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <Cloud className="w-3 h-3 text-brand-400" />
            </div>
            <span className="text-xs text-gray-600">CloudMind</span>
          </div>
          <p className="text-xs text-gray-700">FixInventory · ArangoDB · Claude AI · Next.js · FastAPI</p>
        </div>
      </footer>
    </div>
  );
}
