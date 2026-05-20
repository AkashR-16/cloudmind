"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Cloud, ArrowRight, Loader2, MessageSquare, Network, Shield } from "lucide-react";
import { login } from "@/app/actions/auth";

const HIGHLIGHTS = [
  {
    icon: MessageSquare,
    title: "Natural language queries",
    desc: "Ask about your AWS environment in plain English.",
  },
  {
    icon: Network,
    title: "Graph-aware context",
    desc: "Understands resource relationships across your VPCs.",
  },
  {
    icon: Shield,
    title: "Security insights",
    desc: "Surfaces public buckets, open ports, and IAM risks.",
  },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-violet-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 active:scale-[0.99]"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Signing in…
        </>
      ) : (
        <>
          Sign in
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  );
}

export default function LoginPage() {
  const [state, action] = useFormState(login, null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] bg-surface-card border-r border-surface-border p-12 relative overflow-hidden">
        {/* Background orbs */}
        <div className="orb w-80 h-80 bg-brand-500/8 -top-20 -left-20" />
        <div className="orb w-64 h-64 bg-violet-500/6 bottom-20 -right-10" />
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-brand-500" />
          </div>
          <span className="font-semibold text-lg tracking-tight">CloudMind</span>
        </Link>

        <div className="space-y-10">
          <div>
            <h1 className="text-3xl font-bold leading-snug mb-4">
              Your AWS environment,
              <br />
              <span className="text-gradient">answered instantly.</span>
            </h1>
            <p className="text-gray-400 leading-relaxed">
              CloudMind connects to your FixInventory graph and lets you ask plain-English
              questions about any resource in your infrastructure.
            </p>
          </div>

          <div className="space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Demo bubble */}
        <div className="card-glass p-4 space-y-3 relative">
          <div className="flex justify-end">
            <div className="bg-gradient-to-br from-brand-500 to-brand-600 text-white text-xs px-3 py-2 rounded-2xl rounded-br-sm max-w-[80%] shadow-lg shadow-brand-500/20">
              How many EC2 instances are running?
            </div>
          </div>
          <div className="flex justify-start">
            <div className="bg-white/[0.04] border border-white/[0.08] text-gray-200 text-xs px-3 py-2 rounded-2xl rounded-bl-sm max-w-[80%]">
              Found <strong>3 running</strong> EC2 instances — web-server-01, api-server-01, and worker-node-1.
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        <div className="orb w-80 h-80 bg-brand-500/5 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        {/* Mobile logo */}
        <Link href="/" className="flex items-center gap-2.5 mb-10 lg:hidden">
          <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-brand-500" />
          </div>
          <span className="font-semibold text-lg">CloudMind</span>
        </Link>

        <div className="relative w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-1">Welcome back</h2>
            <p className="text-gray-500 text-sm">Sign in to your CloudMind workspace.</p>
          </div>

          <form action={action} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
                className="input-base"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                className="input-base"
              />
            </div>

            {state?.error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                {state.error}
              </p>
            )}

            <SubmitButton />
          </form>

          <div className="mt-6 text-center">
            <span className="text-xs text-gray-700 bg-white/[0.03] border border-white/[0.06] px-4 py-2 rounded-full">
              Local demo — any credentials work
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
