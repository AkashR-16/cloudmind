"use client";

import { useEffect, useState } from "react";
import { Key, CheckCircle2, XCircle, Loader2, Trash2, Cpu } from "lucide-react";
import { useApiKey } from "@/features/apikey/useApiKey";

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok" }
  | { status: "error"; message: string };

export function SettingsContent() {
  const { apiKey, setApiKey, clearApiKey } = useApiKey();
  const [value, setValue] = useState("");
  const [localMode, setLocalMode] = useState<boolean | null>(null);
  const [test, setTest] = useState<TestState>({ status: "idle" });

  useEffect(() => {
    setValue(apiKey);
  }, [apiKey]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agent/mode")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setLocalMode(Boolean(d.local));
      })
      .catch(() => {
        if (!cancelled) setLocalMode(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTest = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setTest({ status: "testing" });
    try {
      const res = await fetch("/api/agent/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: trimmed, provider: "anthropic" }),
      });
      if (res.ok) {
        setApiKey(trimmed, "anthropic");
        setTest({ status: "ok" });
      } else {
        let detail = `Validation failed (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body?.detail) detail = body.detail;
        } catch {}
        setTest({ status: "error", message: detail });
      }
    } catch (err) {
      setTest({
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  const handleClear = () => {
    clearApiKey();
    setValue("");
    setTest({ status: "idle" });
  };

  const maskedKey = apiKey ? `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}` : "";
  const dirty = value.trim() !== apiKey;
  const showValidIndicator = test.status === "ok" || (!dirty && apiKey.length > 0);
  const hasKey = apiKey.length > 0;
  const cliAvailable = localMode === true;
  const primaryMode: "key" | "cli" | "none" =
    hasKey ? "key" : cliAvailable ? "cli" : "none";

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-gray-400">
            Configure how CloudMind connects to an LLM provider.
          </p>
        </header>

        {/* Mode status card */}
        <section className="rounded-2xl border border-surface-border/60 bg-surface-card/30 p-5">
          <div className="flex items-start gap-3">
            <Cpu className="w-5 h-5 text-brand-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium">LLM mode</h2>
                {primaryMode === "cli" && (
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-brand-200 bg-brand-500/20 border border-brand-500/30 px-2 py-0.5 rounded-md">
                    Primary
                  </span>
                )}
                {primaryMode === "key" && cliAvailable && (
                  <span className="text-[10px] uppercase tracking-wide font-medium text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                    Fallback
                  </span>
                )}
              </div>
              {localMode === null ? (
                <p className="mt-1 text-xs text-gray-500">Detecting…</p>
              ) : localMode ? (
                <p className="mt-1 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1.5 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Local: Claude CLI detected
                  </span>
                  <span className="block mt-1 text-gray-500">
                    {hasKey
                      ? "Available as fallback. Your saved API key takes priority for all requests."
                      : "Requests will use your authenticated Claude Code session. No API key required."}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1.5 text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Production: API key required
                  </span>
                  <span className="block mt-1 text-gray-500">
                    Provide an Anthropic API key below to enable chat.
                  </span>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Anthropic key card */}
        <section className="rounded-2xl border border-surface-border/60 bg-surface-card/30 p-5">
          <div className="flex items-start gap-3 mb-4">
            <Key className="w-5 h-5 text-brand-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium">Anthropic API key</h2>
                {primaryMode === "key" && (
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-brand-200 bg-brand-500/20 border border-brand-500/30 px-2 py-0.5 rounded-md">
                    Primary
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Stored only in your browser (localStorage). Sent to the backend with each chat
                request so calls go through your account.
              </p>
            </div>
            {showValidIndicator && (
              <span
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 shrink-0"
                aria-label="Key validated"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Valid</span>
              </span>
            )}
          </div>

          <div className="space-y-3">
            <input
              type="password"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (test.status !== "idle") setTest({ status: "idle" });
              }}
              onKeyDown={(e) => e.key === "Enter" && handleTest()}
              placeholder="sk-ant-..."
              aria-label="Anthropic API key"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-500/50 placeholder-gray-600 font-mono"
            />

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleTest}
                disabled={!value.trim() || test.status === "testing"}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-200 text-sm font-medium border border-brand-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {test.status === "testing" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Test &amp; save</span>
                  </>
                )}
              </button>

              {apiKey && (
                <button
                  onClick={handleClear}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}

              {apiKey && !dirty && (
                <span className="text-xs text-gray-500 font-mono">Saved: {maskedKey}</span>
              )}
            </div>

            {test.status === "ok" && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Key validated and saved.
              </p>
            )}
            {test.status === "error" && (
              <p className="flex items-start gap-1.5 text-xs text-red-400">
                <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{test.message}</span>
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
