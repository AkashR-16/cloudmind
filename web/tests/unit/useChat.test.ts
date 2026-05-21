import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChat } from "@/features/chat/useChat";

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

describe("useChat", () => {
  it("starts with empty messages", () => {
    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });

  it("adds user and assistant messages after send", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(["Hello", " world"]));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hi there");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[0].content).toBe("Hi there");
    expect(result.current.messages[1].role).toBe("assistant");
    expect(result.current.messages[1].content).toBe("Hello world");
  });

  it("does not send when message is empty", async () => {
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendMessage("   ");
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it("sets error state when fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("test");
    });

    expect(result.current.error).not.toBeNull();
  });

  it("clears session and resets messages", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(["answer"]));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("question");
    });
    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.clearSession();
    });
    expect(result.current.messages).toHaveLength(0);
  });

  it("does not send while already loading", async () => {
    let resolveFirst: () => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFirst = () => resolve(makeStreamResponse(["ok"]));
    });
    mockFetch.mockReturnValueOnce(pending);

    const { result } = renderHook(() => useChat());

    // Start first send (don't await)
    act(() => {
      result.current.sendMessage("first");
    });

    // Attempt second send while loading
    await act(async () => {
      await result.current.sendMessage("second");
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    await act(async () => { resolveFirst!(); });
  });
});
