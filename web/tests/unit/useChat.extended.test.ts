import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChat } from "@/features/chat/useChat";

// ── Setup ─────────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeStreamResponse(chunks: string[]) {
  let index = 0;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index++]));
      } else {
        controller.close();
      }
    },
  });
  return new Response(stream, { status: 200 });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── isLoading lifecycle ──────────────────────────────────────────

describe("useChat — isLoading lifecycle", () => {
  it("isLoading is false before any send", () => {
    const { result } = renderHook(() => useChat());
    expect(result.current.isLoading).toBe(false);
  });

  it("isLoading is false after a successful send completes", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(["done"]));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("isLoading is false after a failed fetch", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network down"));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    expect(result.current.isLoading).toBe(false);
  });
});

// ── error clearing ────────────────────────────────────────────────

describe("useChat — error clearing", () => {
  it("clears a prior error on a new successful send", async () => {
    // First send → error
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("first");
    });
    expect(result.current.error).not.toBeNull();

    // Second send → success
    mockFetch.mockResolvedValueOnce(makeStreamResponse(["All good"]));
    await act(async () => {
      await result.current.sendMessage("second");
    });

    expect(result.current.error).toBeNull();
  });

  it("error is null on initial mount", () => {
    const { result } = renderHook(() => useChat());
    expect(result.current.error).toBeNull();
  });
});

// ── clearSession ──────────────────────────────────────────────────

describe("useChat — clearSession", () => {
  it("generates a new sessionId after clearSession (different from the old one)", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(["ok"]));
    const { result } = renderHook(() => useChat());

    const originalSessionId = result.current.sessionId;

    await act(async () => {
      await result.current.sendMessage("question");
    });

    act(() => {
      result.current.clearSession();
    });

    expect(result.current.sessionId).not.toBe(originalSessionId);
  });

  it("clears error state after clearSession", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Boom"));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("trigger error");
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearSession();
    });

    expect(result.current.error).toBeNull();
  });

  it("clears messages after clearSession", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(["answer"]));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("question");
    });
    expect(result.current.messages.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearSession();
    });

    expect(result.current.messages).toHaveLength(0);
  });
});

// ── HTTP error codes ──────────────────────────────────────────────

describe("useChat — HTTP error handling", () => {
  it("sets error message containing detail text when fetch returns 429", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Rate limit hit" }), { status: 429 })
    );
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("spam");
    });

    expect(result.current.error).toBe("Rate limit hit");
  });

  it("sets a user-friendly error message (not raw '500') when fetch returns 500", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Internal Server Error" }), { status: 500 })
    );
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("test");
    });

    // The hook either surfaces the detail string or falls back to a user-friendly message.
    // Either way, the raw string "500" must NOT be the entire error content.
    expect(result.current.error).not.toBe("500");
    expect(result.current.error).toBeTruthy();
  });

  it("sets fallback error when 500 response has no detail field", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 500 })
    );
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("test");
    });

    // Hook falls back to "Something went wrong. Please try again." for unknown 5xx
    expect(result.current.error).toMatch(/something went wrong|agent error|please try/i);
  });
});

// ── streaming content ─────────────────────────────────────────────

describe("useChat — streaming", () => {
  it("concatenates all chunks into the final assistant message content", async () => {
    mockFetch.mockResolvedValueOnce(
      makeStreamResponse(["Hello", ", ", "world", "!"])
    );
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("greet");
    });

    const assistantMsg = result.current.messages.find((m) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.content).toContain("Hello");
    expect(assistantMsg?.content).toContain("world");
    expect(assistantMsg?.content).toContain("!");
  });

  it("assistant message isStreaming is false after stream finishes", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(["chunk1", "chunk2"]));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("stream test");
    });

    const assistantMsg = result.current.messages.find((m) => m.role === "assistant");
    expect(assistantMsg?.isStreaming).toBe(false);
  });
});

// ── input validation ──────────────────────────────────────────────

describe("useChat — input validation", () => {
  it("does not call fetch when message is only spaces", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("   ");
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not add messages when message is only spaces", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("   ");
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it("does not call fetch for empty string", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("");
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── fetch call contract ───────────────────────────────────────────

describe("useChat — fetch call contract", () => {
  it("calls fetch with POST to /api/agent/chat", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(["ok"]));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/agent/chat");
    expect(options.method).toBe("POST");
  });

  it("includes Content-Type: application/json header", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(["ok"]));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("request body contains session_id field", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(["ok"]));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toHaveProperty("session_id");
    expect(typeof body.session_id).toBe("string");
    expect(body.session_id.length).toBeGreaterThan(0);
  });

  it("request body contains message field matching what was sent", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(["ok"]));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("What are my EC2 instances?");
    });

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.message).toBe("What are my EC2 instances?");
  });

  it("sends the session_id from sessionIdRef (consistent within a session)", async () => {
    mockFetch.mockResolvedValue(makeStreamResponse(["ok"]));
    const { result } = renderHook(() => useChat());

    // Send two messages in sequence and check they use the same session_id
    await act(async () => {
      await result.current.sendMessage("first message");
    });
    await act(async () => {
      await result.current.sendMessage("second message");
    });

    const body1 = JSON.parse(mockFetch.mock.calls[0][1].body);
    const body2 = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body1.session_id).toBe(body2.session_id);
  });

  it("uses a new session_id after clearSession is called", async () => {
    mockFetch.mockResolvedValue(makeStreamResponse(["ok"]));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("before clear");
    });
    const body1 = JSON.parse(mockFetch.mock.calls[0][1].body);

    act(() => {
      result.current.clearSession();
    });

    await act(async () => {
      await result.current.sendMessage("after clear");
    });
    const body2 = JSON.parse(mockFetch.mock.calls[1][1].body);

    expect(body1.session_id).not.toBe(body2.session_id);
  });
});
