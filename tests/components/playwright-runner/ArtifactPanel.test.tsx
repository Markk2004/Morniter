// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ArtifactPanel } from "@/components/playwright-runner/artifacts/ArtifactPanel";
import type { TestArtifact } from "@/lib/playwright-runner/types";

afterEach(() => {
  cleanup();
});

describe("ArtifactPanel Component", () => {
  it("renders artifacts list with download links", () => {
    const artifacts: TestArtifact[] = [
      {
        id: "art-1",
        jobId: "job-100",
        type: "trace",
        filename: "trace.zip",
        size: 51200,
        downloadUrl: "/api/playwright-runner/artifacts/art-1",
        createdAt: new Date().toISOString(),
      },
      {
        id: "art-2",
        jobId: "job-100",
        type: "screenshot",
        filename: "failure-login.png",
        size: 102400,
        createdAt: new Date().toISOString(),
      },
    ];

    render(<ArtifactPanel artifacts={artifacts} />);

    expect(screen.getByText(/Execution Artifacts \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText("trace.zip")).toBeInTheDocument();
    expect(screen.getByText("failure-login.png")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download/i })).toHaveAttribute(
      "href",
      "/api/playwright-runner/artifacts/art-1",
    );
  });
});
