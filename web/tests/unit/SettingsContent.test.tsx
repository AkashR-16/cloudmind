import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsContent } from "@/app/(app)/dashboard/settings/_components/SettingsContent";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  // Default: respond to /api/agent/mode as not-local (force the key UI path).
  mockFetch.mockImplementation(async (url: string) => {
    if (url === "/api/agent/mode") {
      return new Response(JSON.stringify({ local: false }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });
});

describe("SettingsContent (GAP-6 + key-flow smoke)", () => {

  it("renders the page heading and the two cards", async () => {
    render(<SettingsContent />);
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("LLM mode")).toBeInTheDocument();
    expect(screen.getByText("Anthropic API key")).toBeInTheDocument();
  });

  it("shows 'Production: API key required' when /agent/mode reports local=false", async () => {
    render(<SettingsContent />);
    await waitFor(() => {
      expect(screen.getByText("Production: API key required")).toBeInTheDocument();
    });
  });

  it("shows 'Claude CLI detected' when /agent/mode reports local=true", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === "/api/agent/mode") {
        return new Response(JSON.stringify({ local: true }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    render(<SettingsContent />);
    await waitFor(() => {
      expect(screen.getByText("Local: Claude CLI detected")).toBeInTheDocument();
    });
  });

  it("disables Test & save until a key is entered", async () => {
    render(<SettingsContent />);
    const btn = screen.getByRole("button", { name: /Test & save/ });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Anthropic API key"), { target: { value: "sk-ant-test" } });
    expect(screen.getByRole("button", { name: /Test & save/ })).not.toBeDisabled();
  });

  it("saves the key to localStorage and shows 'Valid' on successful test", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === "/api/agent/mode") return new Response(JSON.stringify({ local: false }), { status: 200 });
      if (url === "/api/agent/test-key") return new Response(JSON.stringify({ ok: true, provider: "anthropic" }), { status: 200 });
      return new Response("{}", { status: 200 });
    });

    render(<SettingsContent />);
    fireEvent.change(screen.getByLabelText("Anthropic API key"), { target: { value: "sk-ant-good" } });
    fireEvent.click(screen.getByRole("button", { name: /Test & save/ }));

    await waitFor(() => {
      expect(screen.getByText("Key validated and saved.")).toBeInTheDocument();
    });
    expect(localStorageMock.getItem("cloudmind_api_key")).toBe("sk-ant-good");
    expect(localStorageMock.getItem("cloudmind_api_provider")).toBe("anthropic");
  });

  it("shows error message on failed test, does not save the key", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === "/api/agent/mode") return new Response(JSON.stringify({ local: false }), { status: 200 });
      if (url === "/api/agent/test-key") return new Response(JSON.stringify({ detail: "invalid x-api-key" }), { status: 400 });
      return new Response("{}", { status: 200 });
    });

    render(<SettingsContent />);
    fireEvent.change(screen.getByLabelText("Anthropic API key"), { target: { value: "sk-ant-bad" } });
    fireEvent.click(screen.getByRole("button", { name: /Test & save/ }));

    await waitFor(() => {
      expect(screen.getByText("invalid x-api-key")).toBeInTheDocument();
    });
    expect(localStorageMock.getItem("cloudmind_api_key")).toBeNull();
  });
});
