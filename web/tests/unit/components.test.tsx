import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuggestedPrompts } from "@/app/(app)/dashboard/chat/_components/SuggestedPrompts";
import { InputBar } from "@/app/(app)/dashboard/chat/_components/InputBar";

// ── SuggestedPrompts ─────────────────────────────────────────────

describe("SuggestedPrompts", () => {
  it("renders all 6 prompt buttons", () => {
    render(<SuggestedPrompts onSelect={() => {}} />);
    expect(screen.getByText("Which EC2 instances are running?")).toBeInTheDocument();
    expect(screen.getByText("Show me all public S3 buckets")).toBeInTheDocument();
    expect(screen.getByText("What security groups allow inbound 0.0.0.0/0?")).toBeInTheDocument();
    expect(screen.getByText("How many resources are in us-east-1?")).toBeInTheDocument();
    expect(screen.getByText("List all IAM roles in my account")).toBeInTheDocument();
    expect(screen.getByText("Which RDS instances are not encrypted?")).toBeInTheDocument();
  });

  it("calls onSelect with the prompt text when a button is clicked", () => {
    const onSelect = vi.fn();
    render(<SuggestedPrompts onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Show me all public S3 buckets"));
    expect(onSelect).toHaveBeenCalledWith("Show me all public S3 buckets");
  });

  it("calls onSelect with the correct text for each prompt", () => {
    const onSelect = vi.fn();
    render(<SuggestedPrompts onSelect={onSelect} />);
    fireEvent.click(screen.getByText("What security groups allow inbound 0.0.0.0/0?"));
    expect(onSelect).toHaveBeenCalledWith("What security groups allow inbound 0.0.0.0/0?");
  });

  it("renders 6 clickable buttons in total", () => {
    render(<SuggestedPrompts onSelect={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(6);
  });
});

// ── InputBar ─────────────────────────────────────────────────────

describe("InputBar", () => {
  it("renders textarea and send button", () => {
    render(<InputBar onSend={() => {}} isLoading={false} />);
    expect(screen.getByRole("textbox", { name: /chat input/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
  });

  it("send button is disabled when input is empty", () => {
    render(<InputBar onSend={() => {}} isLoading={false} />);
    expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
  });

  it("send button enables when user types", () => {
    render(<InputBar onSend={() => {}} isLoading={false} />);
    const textarea = screen.getByRole("textbox", { name: /chat input/i });
    fireEvent.change(textarea, { target: { value: "hello" } });
    expect(screen.getByRole("button", { name: /send message/i })).toBeEnabled();
  });

  it("send button remains disabled for whitespace-only input", () => {
    render(<InputBar onSend={() => {}} isLoading={false} />);
    const textarea = screen.getByRole("textbox", { name: /chat input/i });
    fireEvent.change(textarea, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
  });

  it("calls onSend with trimmed input when button clicked", () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} isLoading={false} />);
    const textarea = screen.getByRole("textbox", { name: /chat input/i });
    fireEvent.change(textarea, { target: { value: "  hello world  " } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    expect(onSend).toHaveBeenCalledWith("hello world");
  });

  it("clears textarea after sending", () => {
    render(<InputBar onSend={() => {}} isLoading={false} />);
    const textarea = screen.getByRole("textbox", { name: /chat input/i });
    fireEvent.change(textarea, { target: { value: "test message" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    expect(textarea).toHaveValue("");
  });

  it("sends message on Enter key", () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} isLoading={false} />);
    const textarea = screen.getByRole("textbox", { name: /chat input/i });
    fireEvent.change(textarea, { target: { value: "enter test" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).toHaveBeenCalledWith("enter test");
  });

  it("does not send on Shift+Enter", () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} isLoading={false} />);
    const textarea = screen.getByRole("textbox", { name: /chat input/i });
    fireEvent.change(textarea, { target: { value: "multiline" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("is disabled while loading", () => {
    render(<InputBar onSend={() => {}} isLoading={true} />);
    const textarea = screen.getByRole("textbox", { name: /chat input/i });
    expect(textarea).toBeDisabled();
  });

  it("does not call onSend while loading even with content", () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} isLoading={true} />);
    const button = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(button);
    expect(onSend).not.toHaveBeenCalled();
  });
});
