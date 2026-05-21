"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Message, ChatState } from "./types";
import { generateSessionId } from "@/lib/utils";

const AGENT_TIMEOUT_MS = 90_000;
const WAKE_UP_HINT_MS = 8_000;
const FIRST_TOKEN_TIMEOUT_MS = 20_000;

const SESSION_STORAGE_KEY = "cloudmind_session_id";
const MESSAGES_STORAGE_KEY = "cloudmind_chat_messages";

function loadPersistedSessionId(): string {
  if (typeof window === "undefined") return generateSessionId();
  const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (stored) return stored;
  const fresh = generateSessionId();
  window.localStorage.setItem(SESSION_STORAGE_KEY, fresh);
  return fresh;
}

function loadPersistedMessages(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MESSAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    return parsed.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
      isStreaming: false,
    }));
  } catch {
    return [];
  }
}

export function useChat(apiKey?: string, provider?: string): ChatState & {
  sendMessage: (content: string) => Promise<void>;
  clearSession: () => void;
} {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string>("");

  // Hydrate from localStorage on first client render (avoids SSR mismatch)
  useEffect(() => {
    sessionIdRef.current = loadPersistedSessionId();
    const persisted = loadPersistedMessages();
    if (persisted.length > 0) setMessages(persisted);
  }, []);

  // Persist messages whenever they change (skips empty initial state)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (messages.length === 0) {
      window.localStorage.removeItem(MESSAGES_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const appendToken = useCallback((id: string, token: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, content: m.content + token, isStreaming: true } : m
      )
    );
  }, []);

  const finalizeMessage = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isStreaming: false } : m))
    );
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };
      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      const hardTimeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
      const wakeUpTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
        appendToken(assistantId, "*The backend is starting up (Render free tier — takes ~30s on first request). Hang tight...*");
      }, WAKE_UP_HINT_MS);
      let firstTokenTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        appendToken(assistantId, "\n\n*Almost there...*");
      }, FIRST_TOKEN_TIMEOUT_MS);

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            session_id: sessionIdRef.current,
            ...(apiKey ? { api_key: apiKey } : {}),
            ...(apiKey && provider ? { provider } : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let detail = `Agent error: ${res.status}`;
          try {
            const body = await res.json();
            if (body?.detail) detail = body.detail;
          } catch {}
          throw new Error(detail);
        }
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          if (firstTokenTimer) {
            clearTimeout(firstTokenTimer);
            firstTokenTimer = null;
            // Clear placeholder messages once real tokens arrive
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content
                      .replace(/\*The backend is starting up[^*]*\*\n*/g, "")
                      .replace("*Almost there...*", "") }
                  : m
              )
            );
          }
          clearTimeout(wakeUpTimer);

          appendToken(assistantId, chunk);
        }
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === "AbortError"
            ? "The request timed out. Please try again."
            : err instanceof Error && err.message && !err.message.startsWith("Agent error:")
            ? err.message
            : "Something went wrong. Please try again.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: message, isStreaming: false } : m
          )
        );
        setError(message);
      } finally {
        clearTimeout(hardTimeout);
        clearTimeout(wakeUpTimer);
        if (firstTokenTimer) clearTimeout(firstTokenTimer);
        finalizeMessage(assistantId);
        setIsLoading(false);
      }
    },
    [isLoading, appendToken, finalizeMessage]
  );

  const clearSession = useCallback(() => {
    setMessages([]);
    setError(null);
    const fresh = generateSessionId();
    sessionIdRef.current = fresh;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_STORAGE_KEY, fresh);
      window.localStorage.removeItem(MESSAGES_STORAGE_KEY);
    }
  }, []);

  return {
    messages,
    sessionId: sessionIdRef.current,
    isLoading,
    error,
    sendMessage,
    clearSession,
  };
}
