import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardNav } from "@/components/layout/DashboardNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/chat",
}));

describe("DashboardNav (GAP-6 smoke)", () => {
  it("renders all four tabs in order", () => {
    render(<DashboardNav />);
    const labels = ["Chat", "How It Works", "Architecture", "Settings"];
    for (const l of labels) {
      expect(screen.getByText(l)).toBeInTheDocument();
    }
  });

  it("marks the active tab via aria-current", () => {
    render(<DashboardNav />);
    const chatLink = screen.getByText("Chat").closest("a");
    expect(chatLink).toHaveAttribute("aria-current", "page");
  });

  it("inactive tabs do not have aria-current", () => {
    render(<DashboardNav />);
    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink).not.toHaveAttribute("aria-current");
  });

  it("each tab links to its dashboard route", () => {
    render(<DashboardNav />);
    expect(screen.getByText("Chat").closest("a")).toHaveAttribute("href", "/dashboard/chat");
    expect(screen.getByText("How It Works").closest("a")).toHaveAttribute("href", "/dashboard/how-it-works");
    expect(screen.getByText("Architecture").closest("a")).toHaveAttribute("href", "/dashboard/architecture");
    expect(screen.getByText("Settings").closest("a")).toHaveAttribute("href", "/dashboard/settings");
  });
});
