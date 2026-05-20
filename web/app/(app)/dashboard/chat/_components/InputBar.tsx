"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function InputBar({ onSend, isLoading }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const hasValue = value.trim().length > 0;

  return (
    <div
      className={cn(
        "relative flex items-end gap-3 rounded-2xl px-4 py-3 transition-all duration-200",
        "bg-white/[0.04] backdrop-blur-md border",
        hasValue
          ? "border-brand-500/50 shadow-[0_0_0_1px_rgba(79,110,247,0.15),0_4px_20px_-4px_rgba(79,110,247,0.15)]"
          : "border-white/[0.08] hover:border-white/[0.14]"
      )}
    >
      {isLoading && (
        <div className="absolute left-4 top-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
          <span className="text-xs text-brand-400/70">CloudMind is thinking...</span>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={isLoading ? "" : "Ask about your AWS environment..."}
        disabled={isLoading}
        rows={1}
        aria-label="Chat input"
        className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 resize-none outline-none leading-relaxed disabled:opacity-0"
      />
      <button
        onClick={handleSend}
        disabled={!hasValue || isLoading}
        aria-label="Send message"
        className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
          hasValue && !isLoading
            ? "bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 hover:scale-105 active:scale-95"
            : "bg-white/[0.06] text-gray-600 cursor-not-allowed"
        )}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
