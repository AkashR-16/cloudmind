"use client";

import { useState } from "react";
import { Key, X, Check } from "lucide-react";
import type { LLMProvider } from "@/features/apikey/useApiKey";

interface Props {
  onSave: (key: string, provider: LLMProvider) => void;
  onDismiss: () => void;
  initialProvider?: LLMProvider;
}

const PROVIDERS: { id: LLMProvider; label: string; placeholder: string }[] = [
  { id: "gemini",    label: "Gemini",    placeholder: "AIzaSy..." },
  { id: "openai",    label: "OpenAI",    placeholder: "sk-proj-..." },
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
];

export function ApiKeyBanner({ onSave, onDismiss, initialProvider = "gemini" }: Props) {
  const [selected, setSelected] = useState<LLMProvider>(initialProvider);
  const [value, setValue] = useState("");

  const current = PROVIDERS.find((p) => p.id === selected)!;

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSave(trimmed, selected);
  };

  return (
    <div className="mx-4 mb-2 px-4 py-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-sm space-y-2.5">
      {/* Provider selector row */}
      <div className="flex items-center gap-2">
        <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-amber-300/70 text-xs shrink-0">Provider:</span>
        <div className="flex gap-1">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelected(p.id); setValue(""); }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selected === p.id
                  ? "bg-amber-500/30 text-amber-200 border border-amber-500/50"
                  : "bg-white/5 text-gray-400 hover:text-gray-300 border border-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={onDismiss}
          title="Running locally? Skip this."
          className="ml-auto shrink-0 text-gray-600 hover:text-gray-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Key input row */}
      <div className="flex items-center gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder={`Paste your ${current.label} API key (${current.placeholder})`}
          aria-label="Chat input"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-amber-500/50 placeholder-gray-600 min-w-0"
        />
        <button
          onClick={handleSave}
          disabled={!value.trim()}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Save</span>
        </button>
      </div>
    </div>
  );
}
