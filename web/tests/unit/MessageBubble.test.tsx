import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "@/app/(app)/dashboard/chat/_components/MessageBubble";
import type { Message } from "@/features/chat/types";

function makeMsg(overrides: Partial<Message> = {}): Message {
  return { id: "1", role: "user", content: "hello", timestamp: new Date(), ...overrides };
}

// ── MessageBubble ────────────────────────────────────────────────

describe("MessageBubble — user messages", () => {
  it("renders user message content as plain text", () => {
    render(<MessageBubble message={makeMsg({ content: "Hello world" })} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("user message container has flex-row-reverse layout (bubble on right)", () => {
    const { container } = render(<MessageBubble message={makeMsg({ role: "user" })} />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toMatch(/flex-row-reverse/);
  });

  it("user message does NOT have flex-row layout", () => {
    const { container } = render(<MessageBubble message={makeMsg({ role: "user" })} />);
    const outerDiv = container.firstChild as HTMLElement;
    // flex-row-reverse must be present; plain flex-row must not appear without -reverse
    expect(outerDiv.className).not.toMatch(/flex-row(?!-reverse)/);
  });

  it("shows User icon (not Cloud icon) for user messages", () => {
    const { container } = render(<MessageBubble message={makeMsg({ role: "user" })} />);
    // lucide-react renders SVGs; User icon is used for user, Cloud for assistant.
    // The icon wrapper has a gradient background class unique to user messages.
    const iconWrapper = container.querySelector(".from-brand-500.to-violet-500");
    expect(iconWrapper).toBeInTheDocument();
  });

  it("renders empty content without crashing", () => {
    expect(() =>
      render(<MessageBubble message={makeMsg({ content: "" })} />)
    ).not.toThrow();
  });

  it("renders very long content without truncation", () => {
    const longContent = "A".repeat(600);
    render(<MessageBubble message={makeMsg({ content: longContent })} />);
    expect(screen.getByText(longContent)).toBeInTheDocument();
  });

  it("user message plain text is not passed through ReactMarkdown (raw asterisks stay literal)", () => {
    render(<MessageBubble message={makeMsg({ content: "**bold**" })} />);
    // For user messages, content is rendered as a raw <span>, so **bold** should appear verbatim.
    expect(screen.getByText("**bold**")).toBeInTheDocument();
    // No <strong> element should be produced for user messages.
    expect(document.querySelector("strong")).toBeNull();
  });
});

describe("MessageBubble — assistant messages", () => {
  it("renders assistant message content through ReactMarkdown", () => {
    render(
      <MessageBubble
        message={makeMsg({ role: "assistant", content: "**bold text**" })}
      />
    );
    // ReactMarkdown converts **…** to <strong>
    expect(screen.getByRole("strong") ?? document.querySelector("strong")).toBeTruthy();
    expect(screen.getByText("bold text")).toBeInTheDocument();
  });

  it("assistant message has flex-row layout (bubble on left)", () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ role: "assistant", content: "hi" })} />
    );
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toMatch(/flex-row(?!-reverse)/);
    expect(outerDiv.className).not.toMatch(/flex-row-reverse/);
  });

  it("shows Cloud icon (not User icon) for assistant messages", () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ role: "assistant", content: "hi" })} />
    );
    // The assistant icon wrapper uses bg-surface-card class, distinguishing it from the user icon wrapper.
    const iconWrapper = container.querySelector(".bg-surface-card");
    expect(iconWrapper).toBeInTheDocument();
  });

  it("markdown code blocks render as <code> elements", () => {
    render(
      <MessageBubble
        message={makeMsg({
          role: "assistant",
          content: "Here is code: `const x = 1;`",
        })}
      />
    );
    const codeEl = document.querySelector("code");
    expect(codeEl).toBeInTheDocument();
    expect(codeEl?.textContent).toContain("const x = 1;");
  });

  it("markdown fenced code blocks render as <code> inside <pre>", () => {
    render(
      <MessageBubble
        message={makeMsg({
          role: "assistant",
          content: "```\nconst y = 2;\n```",
        })}
      />
    );
    const preEl = document.querySelector("pre");
    expect(preEl).toBeInTheDocument();
    expect(preEl?.querySelector("code")).toBeInTheDocument();
  });

  it("markdown bullet lists render as <ul><li> elements", () => {
    render(
      <MessageBubble
        message={makeMsg({
          role: "assistant",
          content: "- Item one\n- Item two\n- Item three",
        })}
      />
    );
    const ul = document.querySelector("ul");
    expect(ul).toBeInTheDocument();
    const items = document.querySelectorAll("li");
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it("renders empty content without crashing", () => {
    expect(() =>
      render(
        <MessageBubble message={makeMsg({ role: "assistant", content: "" })} />
      )
    ).not.toThrow();
  });
});

describe("MessageBubble — isStreaming prop", () => {
  it("adds streaming-cursor class to the prose div when isStreaming is true", () => {
    const { container } = render(
      <MessageBubble
        message={makeMsg({ role: "assistant", content: "thinking…", isStreaming: true })}
      />
    );
    const proseDiv = container.querySelector(".prose");
    expect(proseDiv).toBeInTheDocument();
    expect(proseDiv?.className).toContain("streaming-cursor");
  });

  it("does NOT add streaming-cursor class when isStreaming is false", () => {
    const { container } = render(
      <MessageBubble
        message={makeMsg({ role: "assistant", content: "done", isStreaming: false })}
      />
    );
    const proseDiv = container.querySelector(".prose");
    expect(proseDiv).toBeInTheDocument();
    expect(proseDiv?.className).not.toContain("streaming-cursor");
  });

  it("does NOT add streaming-cursor class when isStreaming is undefined (default)", () => {
    const { container } = render(
      <MessageBubble
        message={makeMsg({ role: "assistant", content: "done" })}
      />
    );
    const proseDiv = container.querySelector(".prose");
    expect(proseDiv?.className).not.toContain("streaming-cursor");
  });

  it("streaming-cursor class is never added to user messages even if isStreaming is true", () => {
    const { container } = render(
      <MessageBubble
        message={makeMsg({ role: "user", content: "hi", isStreaming: true })}
      />
    );
    // User messages don't have a prose div at all.
    const proseDiv = container.querySelector(".prose");
    expect(proseDiv).toBeNull();
  });
});
