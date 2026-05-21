import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useApiKey } from "@/features/apikey/useApiKey";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

describe("useApiKey", () => {
  it("starts with empty apiKey when nothing in localStorage", () => {
    const { result } = renderHook(() => useApiKey());
    expect(result.current.apiKey).toBe("");
  });

  it("defaults to gemini provider", () => {
    const { result } = renderHook(() => useApiKey());
    expect(result.current.provider).toBe("gemini");
  });

  it("reads existing key from localStorage on mount", () => {
    localStorageMock.setItem("cloudmind_api_key", "AIzaSyExistingKey");
    const { result } = renderHook(() => useApiKey());
    expect(result.current.apiKey).toBe("AIzaSyExistingKey");
  });

  it("reads existing provider from localStorage on mount", () => {
    localStorageMock.setItem("cloudmind_api_provider", "openai");
    const { result } = renderHook(() => useApiKey());
    expect(result.current.provider).toBe("openai");
  });

  it("setApiKey persists trimmed key to localStorage", () => {
    const { result } = renderHook(() => useApiKey());
    act(() => result.current.setApiKey("  AIzaSyNewKey  "));
    expect(result.current.apiKey).toBe("AIzaSyNewKey");
    expect(localStorageMock.getItem("cloudmind_api_key")).toBe("AIzaSyNewKey");
  });

  it("setApiKey with provider saves both key and provider", () => {
    const { result } = renderHook(() => useApiKey());
    act(() => result.current.setApiKey("sk-proj-test", "openai"));
    expect(result.current.apiKey).toBe("sk-proj-test");
    expect(result.current.provider).toBe("openai");
    expect(localStorageMock.getItem("cloudmind_api_provider")).toBe("openai");
  });

  it("setProvider updates provider state and localStorage", () => {
    const { result } = renderHook(() => useApiKey());
    act(() => result.current.setProvider("anthropic"));
    expect(result.current.provider).toBe("anthropic");
    expect(localStorageMock.getItem("cloudmind_api_provider")).toBe("anthropic");
  });

  it("setApiKey clears dismissed flag so banner can show again", () => {
    localStorageMock.setItem("cloudmind_api_key_dismissed", "true");
    const { result } = renderHook(() => useApiKey());
    act(() => result.current.setApiKey("AIzaSyNewKey"));
    expect(localStorageMock.getItem("cloudmind_api_key_dismissed")).toBeNull();
    expect(result.current.dismissed).toBe(false);
  });

  it("clearApiKey removes key from localStorage and state", () => {
    localStorageMock.setItem("cloudmind_api_key", "AIzaSyOldKey");
    const { result } = renderHook(() => useApiKey());
    act(() => result.current.clearApiKey());
    expect(result.current.apiKey).toBe("");
    expect(localStorageMock.getItem("cloudmind_api_key")).toBeNull();
  });

  it("dismiss sets dismissed to true and persists to localStorage", () => {
    const { result } = renderHook(() => useApiKey());
    act(() => result.current.dismiss());
    expect(result.current.dismissed).toBe(true);
    expect(localStorageMock.getItem("cloudmind_api_key_dismissed")).toBe("true");
  });

  it("starts dismissed=true when localStorage has dismissed flag", () => {
    localStorageMock.setItem("cloudmind_api_key_dismissed", "true");
    const { result } = renderHook(() => useApiKey());
    expect(result.current.dismissed).toBe(true);
  });
});
