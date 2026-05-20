"use client";

import { useState, useCallback, useRef } from "react";
import { Message, ChatState } from "./types";
import { generateSessionId } from "@/lib/utils";

const AGENT_TIMEOUT_MS = 20_000;
const FIRST_TOKEN_TIMEOUT_MS = 10_000;

export function useChat(): ChatState & {
  sendMessage: (content: string) => Promise<void>;
  clearSession: () => void;
} {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string>(generateSessionId());

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
      let firstTokenTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        appendToken(assistantId, "*Still working on it...*");
      }, FIRST_TOKEN_TIMEOUT_MS);

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            session_id: sessionIdRef.current,
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
            // Clear the "still working" placeholder if it was added
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content.replace("*Still working on it...*", "") }
                  : m
              )
            );
          }

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
    sessionIdRef.current = generateSessionId();
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
