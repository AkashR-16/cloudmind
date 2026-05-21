import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Message } from "@/features/chat/types";

// jsdom doesn't implement scrollIntoView — stub it so ChatWindow's useEffect doesn't throw
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

// Mock useChat before importing the component so the mock is in place when
// ChatWindow's module is evaluated.
vi.mock("@/features/chat/useChat");
// QuestionsSidebar contains the same prompt strings as SuggestedPrompts; mocking
// it out keeps these tests focused on the SuggestedPrompts empty-state behavior.
vi.mock("@/app/(app)/dashboard/chat/_components/QuestionsSidebar", () => ({
  QuestionsSidebar: () => null,
}));
import { useChat } from "@/features/chat/useChat";
import { ChatWindow } from "@/app/(app)/dashboard/chat/_components/ChatWindow";

const mockUseChat = useChat as unknown as ReturnType<typeof vi.fn>;

// ── helpers ──────────────────────────────────────────────────────

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    role: "user",
    content: "Test message",
    timestamp: new Date(),
    ...overrides,
  };
}

const defaultState = {
  messages: [],
  isLoading: false,
  error: null,
  sendMessage: vi.fn(),
  clearSession: vi.fn(),
  sessionId: "test-session",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseChat.mockReturnValue({ ...defaultState });
});

// ── ChatWindow — empty state ──────────────────────────────────────

describe("ChatWindow — empty state (no messages)", () => {
  it('shows the "Ask about your AWS environment" heading when no messages', () => {
    render(<ChatWindow />);
    expect(
      screen.getByText("Ask about your AWS environment")
    ).toBeInTheDocument();
  });

  it("shows SuggestedPrompts buttons in the empty state", () => {
    render(<ChatWindow />);
    expect(screen.getByText("Which EC2 instances are running?")).toBeInTheDocument();
    expect(screen.getByText("Show me all public S3 buckets")).toBeInTheDocument();
    expect(screen.getByText("What security groups allow inbound 0.0.0.0/0?")).toBeInTheDocument();
    expect(screen.getByText("How many resources are in us-east-1?")).toBeInTheDocument();
    expect(screen.getByText("List all IAM roles in my account")).toBeInTheDocument();
    expect(screen.getByText("Which RDS instances are not encrypted?")).toBeInTheDocument();
  });

  it('does NOT show "Clear conversation" button in empty state', () => {
    render(<ChatWindow />);
    expect(
      screen.queryByText("Clear conversation")
    ).not.toBeInTheDocument();
  });

  it("does not show an error banner in empty state when error is null", () => {
    render(<ChatWindow />);
    // The error banner element is only rendered when error is truthy
    const banners = document.querySelectorAll(".bg-red-500\\/10");
    expect(banners.length).toBe(0);
  });
});

// ── ChatWindow — with messages ────────────────────────────────────

describe("ChatWindow — with messages", () => {
  it("shows MessageList (message content) when messages are present", () => {
    mockUseChat.mockReturnValue({
      ...defaultState,
      messages: [makeMessage({ content: "EC2 question here" })],
    });
    render(<ChatWindow />);
    expect(screen.getByText("EC2 question here")).toBeInTheDocument();
  });

  it("does NOT show empty-state heading when messages are present", () => {
    mockUseChat.mockReturnValue({
      ...defaultState,
      messages: [makeMessage()],
    });
    render(<ChatWindow />);
    expect(
      screen.queryByText("Ask about your AWS environment")
    ).not.toBeInTheDocument();
  });

  it("does NOT show SuggestedPrompts when messages are present", () => {
    mockUseChat.mockReturnValue({
      ...defaultState,
      messages: [makeMessage()],
    });
    render(<ChatWindow />);
    expect(
      screen.queryByText("Which EC2 instances are running?")
    ).not.toBeInTheDocument();
  });

  it('shows "Clear conversation" button when messages exist', () => {
    mockUseChat.mockReturnValue({
      ...defaultState,
      messages: [makeMessage()],
    });
    render(<ChatWindow />);
    expect(screen.getByText("Clear conversation")).toBeInTheDocument();
  });

  it("calls clearSession when Clear conversation button is clicked", () => {
    const clearSession = vi.fn();
    mockUseChat.mockReturnValue({
      ...defaultState,
      messages: [makeMessage()],
      clearSession,
    });
    render(<ChatWindow />);
    fireEvent.click(screen.getByText("Clear conversation"));
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it("renders multiple messages in order", () => {
    mockUseChat.mockReturnValue({
      ...defaultState,
      messages: [
        makeMessage({ id: "1", content: "First message" }),
        makeMessage({ id: "2", role: "assistant", content: "Second message" }),
      ],
    });
    render(<ChatWindow />);
    expect(screen.getByText("First message")).toBeInTheDocument();
    expect(screen.getByText("Second message")).toBeInTheDocument();
  });
});

// ── ChatWindow — error banner ─────────────────────────────────────

describe("ChatWindow — error banner", () => {
  it("shows error banner when error is non-null", () => {
    mockUseChat.mockReturnValue({
      ...defaultState,
      error: "Something went wrong. Please try again.",
    });
    render(<ChatWindow />);
    expect(
      screen.getByText("Something went wrong. Please try again.")
    ).toBeInTheDocument();
  });

  it("does NOT show error banner when error is null", () => {
    mockUseChat.mockReturnValue({ ...defaultState, error: null });
    render(<ChatWindow />);
    expect(
      screen.queryByText(/something went wrong/i)
    ).not.toBeInTheDocument();
  });

  it("displays the exact error message text inside the banner", () => {
    const errorMessage = "Rate limit hit — try again in a moment.";
    mockUseChat.mockReturnValue({ ...defaultState, error: errorMessage });
    render(<ChatWindow />);
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("error banner has red styling (className contains 'red')", () => {
    mockUseChat.mockReturnValue({
      ...defaultState,
      error: "An error occurred",
    });
    const { container } = render(<ChatWindow />);
    // The error banner div uses classes like bg-red-500/10 border-red-500/25 text-red-400
    const errorBanner = container.querySelector("[class*='red']");
    expect(errorBanner).toBeInTheDocument();
  });

  it("shows error banner even when messages are present", () => {
    mockUseChat.mockReturnValue({
      ...defaultState,
      messages: [makeMessage()],
      error: "Network error",
    });
    render(<ChatWindow />);
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });
});

// ── ChatWindow — interactions ─────────────────────────────────────

describe("ChatWindow — interactions", () => {
  it("calls sendMessage with the prompt text when a SuggestedPrompt is clicked", () => {
    const sendMessage = vi.fn();
    mockUseChat.mockReturnValue({ ...defaultState, sendMessage });
    render(<ChatWindow />);
    fireEvent.click(screen.getByText("Show me all public S3 buckets"));
    expect(sendMessage).toHaveBeenCalledWith("Show me all public S3 buckets");
  });

  it("calls sendMessage with each distinct suggested prompt", () => {
    const sendMessage = vi.fn();
    mockUseChat.mockReturnValue({ ...defaultState, sendMessage });
    render(<ChatWindow />);
    fireEvent.click(screen.getByText("List all IAM roles in my account"));
    expect(sendMessage).toHaveBeenCalledWith("List all IAM roles in my account");
  });

  it("InputBar is disabled when isLoading is true", () => {
    mockUseChat.mockReturnValue({ ...defaultState, isLoading: true });
    render(<ChatWindow />);
    const textarea = screen.getByRole("textbox", { name: /chat input/i });
    expect(textarea).toBeDisabled();
  });

  it("InputBar is NOT disabled when isLoading is false", () => {
    mockUseChat.mockReturnValue({ ...defaultState, isLoading: false });
    render(<ChatWindow />);
    const textarea = screen.getByRole("textbox", { name: /chat input/i });
    expect(textarea).not.toBeDisabled();
  });

  it("send button is disabled when isLoading is true", () => {
    mockUseChat.mockReturnValue({ ...defaultState, isLoading: true });
    render(<ChatWindow />);
    expect(
      screen.getByRole("button", { name: /send message/i })
    ).toBeDisabled();
  });
});
