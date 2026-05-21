import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionsSidebar } from "@/app/(app)/dashboard/chat/_components/QuestionsSidebar";

describe("QuestionsSidebar (GAP-6 smoke)", () => {
  it("renders all four category headings", () => {
    render(<QuestionsSidebar onSelect={() => {}} />);
    expect(screen.getByText("Compute")).toBeInTheDocument();
    expect(screen.getByText("Storage & data")).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
    expect(screen.getByText("Security & identity")).toBeInTheDocument();
  });

  it("renders 12 question buttons (3 per category × 4 categories)", () => {
    render(<QuestionsSidebar onSelect={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(12);
  });

  it("calls onSelect with the exact question text when a button is clicked", () => {
    const onSelect = vi.fn();
    render(<QuestionsSidebar onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Which EC2 instances are running?"));
    expect(onSelect).toHaveBeenCalledWith("Which EC2 instances are running?");
  });

  it("disables every button when disabled prop is true", () => {
    render(<QuestionsSidebar onSelect={() => {}} disabled />);
    for (const b of screen.getAllByRole("button")) {
      expect(b).toBeDisabled();
    }
  });

  it("buttons are enabled by default", () => {
    render(<QuestionsSidebar onSelect={() => {}} />);
    for (const b of screen.getAllByRole("button")) {
      expect(b).not.toBeDisabled();
    }
  });
});
