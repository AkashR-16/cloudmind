import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ApiKeyBanner } from "@/app/(app)/dashboard/chat/_components/ApiKeyBanner";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ApiKeyBanner", () => {
  it("renders the key input field (Gemini default)", () => {
    render(<ApiKeyBanner onSave={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Paste your Gemini API key/i)).toBeInTheDocument();
  });

  it("renders provider selector buttons", () => {
    render(<ApiKeyBanner onSave={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: /gemini/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /openai/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /anthropic/i })).toBeInTheDocument();
  });

  it("switching provider updates placeholder", () => {
    render(<ApiKeyBanner onSave={vi.fn()} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /openai/i }));
    expect(screen.getByPlaceholderText(/sk-proj/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /anthropic/i }));
    expect(screen.getByPlaceholderText(/sk-ant/i)).toBeInTheDocument();
  });

  it("renders the Save button", () => {
    render(<ApiKeyBanner onSave={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("Save button is disabled when input is empty", () => {
    render(<ApiKeyBanner onSave={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("Save button is enabled after typing a key", () => {
    render(<ApiKeyBanner onSave={vi.fn()} onDismiss={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Paste your Gemini API key/i), {
      target: { value: "AIzaSyTestKey" },
    });
    expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
  });

  it("calls onSave with key and provider when Save is clicked", () => {
    const onSave = vi.fn();
    render(<ApiKeyBanner onSave={onSave} onDismiss={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Paste your Gemini API key/i), {
      target: { value: "AIzaSyTestKey" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith("AIzaSyTestKey", "gemini");
  });

  it("calls onSave with openai provider when OpenAI is selected", () => {
    const onSave = vi.fn();
    render(<ApiKeyBanner onSave={onSave} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /openai/i }));
    fireEvent.change(screen.getByPlaceholderText(/sk-proj/i), {
      target: { value: "sk-proj-testkey" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith("sk-proj-testkey", "openai");
  });

  it("calls onSave when Enter is pressed in the input", () => {
    const onSave = vi.fn();
    render(<ApiKeyBanner onSave={onSave} onDismiss={vi.fn()} />);
    const input = screen.getByPlaceholderText(/Paste your Gemini API key/i);
    fireEvent.change(input, { target: { value: "AIzaSyTestKey" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith("AIzaSyTestKey", "gemini");
  });

  it("does not call onSave when Enter pressed with empty input", () => {
    const onSave = vi.fn();
    render(<ApiKeyBanner onSave={onSave} onDismiss={vi.fn()} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/Paste your Gemini API key/i), { key: "Enter" });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onDismiss when the dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<ApiKeyBanner onSave={vi.fn()} onDismiss={onDismiss} />);
    const dismissBtn = screen.getByTitle(/Running locally/i);
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("input is of type password (hides the key)", () => {
    render(<ApiKeyBanner onSave={vi.fn()} onDismiss={vi.fn()} />);
    const input = screen.getByPlaceholderText(/Paste your Gemini API key/i);
    expect(input).toHaveAttribute("type", "password");
  });

  it("respects initialProvider prop", () => {
    render(<ApiKeyBanner onSave={vi.fn()} onDismiss={vi.fn()} initialProvider="anthropic" />);
    expect(screen.getByPlaceholderText(/sk-ant/i)).toBeInTheDocument();
  });
});
