import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "@/features/chat/useChat";

// ── localStorage mock (vitest's jsdom has one, but we want isolation per test) ──
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    _peek: () => ({ ...store }),
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeStreamResponse(chunks: string[]) {
  let i = 0;
  const enc = new TextEncoder();
  return new Response(new ReadableStream({
    pull(c) {
      if (i < chunks.length) c.enqueue(enc.encode(chunks[i++]));
      else c.close();
    },
  }), { status: 200 });
}

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

const SESSION_KEY = "cloudmind_session_id";
const MESSAGES_KEY = "cloudmind_chat_messages";

describe("useChat — session persistence (GAP-4)", () => {

  it("generates and persists a sessionId on first mount", async () => {
    renderHook(() => useChat());
    await waitFor(() => {
      expect(localStorageMock.getItem(SESSION_KEY)).toBeTruthy();
    });
  });

  it("reuses the same sessionId across remounts", async () => {
    const { unmount } = renderHook(() => useChat());
    await waitFor(() => expect(localStorageMock.getItem(SESSION_KEY)).toBeTruthy());
    const first = localStorageMock.getItem(SESSION_KEY);
    unmount();

    renderHook(() => useChat());
    // No new id should be generated
    expect(localStorageMock.getItem(SESSION_KEY)).toBe(first);
  });

  it("hydrates messages from localStorage on mount", async () => {
    const saved = [
      { id: "u-1", role: "user", content: "Hi", timestamp: new Date().toISOString(), isStreaming: false },
      { id: "a-1", role: "assistant", content: "Hello", timestamp: new Date().toISOString(), isStreaming: false },
    ];
    localStorageMock.setItem(MESSAGES_KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });
    expect(result.current.messages[0].content).toBe("Hi");
    expect(result.current.messages[1].content).toBe("Hello");
  });

  it("hydrated messages have isStreaming forced to false", async () => {
    // A page reload mid-stream should not leave messages perpetually "streaming"
    const saved = [
      { id: "a-1", role: "assistant", content: "partial", timestamp: new Date().toISOString(), isStreaming: true },
    ];
    localStorageMock.setItem(MESSAGES_KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useChat());

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0].isStreaming).toBe(false);
  });

  it("persists messages to localStorage after sendMessage completes", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(["pong"]));
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(localStorageMock.getItem(SESSION_KEY)).toBeTruthy());

    await act(async () => {
      await result.current.sendMessage("ping");
    });

    const stored = JSON.parse(localStorageMock.getItem(MESSAGES_KEY) || "[]");
    expect(stored).toHaveLength(2);
    expect(stored[0].role).toBe("user");
    expect(stored[0].content).toBe("ping");
    expect(stored[1].role).toBe("assistant");
    expect(stored[1].content).toBe("pong");
  });

  it("clearSession wipes both sessionId and messages from localStorage and rolls a new id", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(["x"]));
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(localStorageMock.getItem(SESSION_KEY)).toBeTruthy());
    const originalId = localStorageMock.getItem(SESSION_KEY);

    await act(async () => {
      await result.current.sendMessage("hi");
    });
    expect(localStorageMock.getItem(MESSAGES_KEY)).toBeTruthy();

    act(() => {
      result.current.clearSession();
    });

    // Messages key is removed
    expect(localStorageMock.getItem(MESSAGES_KEY)).toBeNull();
    // Session id is rolled, not removed (so subsequent requests still have one)
    const newId = localStorageMock.getItem(SESSION_KEY);
    expect(newId).toBeTruthy();
    expect(newId).not.toBe(originalId);
  });

  it("removes the messages key from localStorage when messages becomes empty", async () => {
    // Pre-seed messages
    localStorageMock.setItem(MESSAGES_KEY, JSON.stringify([
      { id: "x", role: "user", content: "x", timestamp: new Date().toISOString(), isStreaming: false },
    ]));
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => {
      result.current.clearSession();
    });

    expect(localStorageMock.getItem(MESSAGES_KEY)).toBeNull();
  });

  it("tolerates malformed persisted messages JSON without crashing", async () => {
    localStorageMock.setItem(MESSAGES_KEY, "this is not json {{{");
    const { result } = renderHook(() => useChat());
    // Should not throw; should just render with empty messages
    await waitFor(() => expect(result.current).toBeTruthy());
    expect(result.current.messages).toHaveLength(0);
  });
});
