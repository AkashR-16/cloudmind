"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@/features/chat/useChat";
import { useApiKey } from "@/features/apikey/useApiKey";
import { MessageList } from "./MessageList";
import { InputBar } from "./InputBar";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { ApiKeyBanner } from "./ApiKeyBanner";
import { Cloud, Zap, RotateCcw } from "lucide-react";

export function ChatWindow() {
  const { apiKey, provider, dismissed, setApiKey, setProvider, dismiss } = useApiKey();
  const { messages, isLoading, error, sendMessage, clearSession } = useChat(apiKey, provider);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Show banner when backend signals no API key (deployed mode, no key configured)
  useEffect(() => {
    if (error?.includes("No API key")) {
      setShowBanner(true);
    }
  }, [error]);

  // Hide banner once a key is saved
  useEffect(() => {
    if (apiKey) setShowBanner(false);
  }, [apiKey]);

  const handleKeySave = (key: string, p: import("@/features/apikey/useApiKey").LLMProvider) => {
    setApiKey(key, p);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    dismiss();
    setShowBanner(false);
  };

  const isEmpty = messages.length === 0;
  const bannerVisible = showBanner && !apiKey && !dismissed;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] relative">
      {/* Background orb */}
      <div className="orb w-[500px] h-[500px] bg-brand-500/5 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 relative">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-fade-in space-y-8">
            <EmptyState />
            <SuggestedPrompts onSelect={sendMessage} />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-1">
            <MessageList messages={messages} />
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && !error.includes("No API key") && (
        <div className="mx-4 mb-2 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-sm text-center flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          {error}
        </div>
      )}

      {/* API key banner */}
      {bannerVisible && (
        <ApiKeyBanner onSave={handleKeySave} onDismiss={handleDismiss} initialProvider={provider} />
      )}

      {/* Input */}
      <div className="relative px-4 pb-4 pt-2">
        {/* Fade gradient above input */}
        <div className="absolute -top-8 inset-x-0 h-8 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto space-y-2">
          <InputBar onSend={sendMessage} isLoading={isLoading} />
          {messages.length > 0 && (
            <div className="flex justify-center">
              <button
                onClick={clearSession}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Clear conversation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-20 h-20">
        <div className="w-20 h-20 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
          <Cloud className="text-brand-400 w-9 h-9" />
        </div>
        <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
        </div>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Ask about your AWS environment</h2>
        <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">
          Connected to your FixInventory graph. Ask about EC2 instances, S3 buckets,
          VPCs, security groups, IAM roles, and more.
        </p>
      </div>
    </div>
  );
}
