import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArchitectureContent } from "@/app/(app)/dashboard/architecture/_components/ArchitectureContent";

describe("ArchitectureContent (GAP-6 smoke)", () => {
  it("renders the page heading", () => {
    render(<ArchitectureContent />);
    expect(screen.getByRole("heading", { name: "Architecture" })).toBeInTheDocument();
  });

  it("renders all five container names", () => {
    render(<ArchitectureContent />);
    // Each container appears at least once (in the diagram lane and/or in the reference table)
    for (const name of ["floci", "fixworker", "fixcore", "arangodb", "redis"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it("renders the lane labels for the four-layer flow", () => {
    render(<ArchitectureContent />);
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText("Storage")).toBeInTheDocument();
    expect(screen.getByText("Application")).toBeInTheDocument();
  });

  it("renders the three capability cards", () => {
    render(<ArchitectureContent />);
    expect(screen.getByText("Zero-AWS demo")).toBeInTheDocument();
    expect(screen.getByText("Real discovery pipeline")).toBeInTheDocument();
    expect(screen.getByText("Grounded LLM answers")).toBeInTheDocument();
  });

  it("renders the end-to-end summary section", () => {
    render(<ArchitectureContent />);
    expect(screen.getByText("End-to-end in one paragraph")).toBeInTheDocument();
  });
});
