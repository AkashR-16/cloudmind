"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "cloudmind_api_key";
const DISMISSED_KEY = "cloudmind_api_key_dismissed";
const PROVIDER_KEY = "cloudmind_api_provider";

export type LLMProvider = "gemini" | "openai" | "anthropic";

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string>("");
  const [provider, setProviderState] = useState<LLMProvider>("gemini");
  const [dismissed, setDismissedState] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setApiKeyState(stored);
    const storedProvider = localStorage.getItem(PROVIDER_KEY) as LLMProvider | null;
    if (storedProvider) setProviderState(storedProvider);
    const isDismissed = localStorage.getItem(DISMISSED_KEY) === "true";
    setDismissedState(isDismissed);
  }, []);

  const setApiKey = useCallback((key: string, p?: LLMProvider) => {
    const trimmed = key.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    localStorage.removeItem(DISMISSED_KEY);
    setApiKeyState(trimmed);
    setDismissedState(false);
    if (p) {
      localStorage.setItem(PROVIDER_KEY, p);
      setProviderState(p);
    }
  }, []);

  const setProvider = useCallback((p: LLMProvider) => {
    localStorage.setItem(PROVIDER_KEY, p);
    setProviderState(p);
  }, []);

  const clearApiKey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKeyState("");
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissedState(true);
  }, []);

  return { apiKey, provider, dismissed, setApiKey, setProvider, clearApiKey, dismiss };
}
