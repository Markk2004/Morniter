import { describe, expect, it } from "vitest";
import {
  analyzeSourceForPlaywrightDraft,
  type SourceAnalysisInput,
} from "../../../agent/src/source-analyzer";
import type { AutomationMap } from "../../../agent/src/types";

describe("Source Analyzer Engine", () => {
  const sampleMap: AutomationMap = {
    version: 1,
    projectId: "project-sts",
    scanRoots: [{ path: "frontend/e2e", runner: "playwright", executable: true }],
    excludeDirectories: ["node_modules"],
    functions: [],
    explicitMappings: [],
    coverageTargets: [],
    generatedRoot: "frontend/e2e/generated",
    productionHostDenylist: ["prod.example.com"],
    testTarget: {
      id: "local",
      label: "Local Dev",
      baseUrl: "http://localhost:3000",
      allowMutating: true,
    },
    reusableFlows: [
      {
        id: "login-as-uat-user",
        name: "Login as UAT user",
        actions: [
          { kind: "goto", url: "/login" },
          { kind: "fill", target: "input[name='username']", value: "uat_tester" },
          { kind: "click", target: "button[type='submit']" },
        ],
      },
    ],
    recipes: [],
  };

  it("extracts route, role, and text assertions from a React Testing Library / Node test snippet", () => {
    const sourceCode = `
      import { render, screen, fireEvent } from "@testing-library/react";
      import DashboardView from "./DashboardView";

      describe("DashboardView", () => {
        it("navigates to /dashboard and verifies heading", () => {
          window.history.pushState({}, "Dashboard", "/dashboard");
          render(<DashboardView />);
          expect(screen.getByRole("heading", { name: "System Overview" })).toBeInTheDocument();
          expect(screen.getByText("Active Nodes")).toBeInTheDocument();
        });
      });
    `;

    const input: SourceAnalysisInput = {
      sourceCode,
      relativePath: "frontend/src/views/DashboardView.test.tsx",
      testTitle: "navigates to /dashboard and verifies heading",
      functionId: "FN-STS-02",
      functionName: "Dashboard",
      map: sampleMap,
    };

    const result = analyzeSourceForPlaywrightDraft(input);

    expect(result.title).toBe("navigates to /dashboard and verifies heading");
    expect(result.functionId).toBe("FN-STS-02");
    expect(result.suggestedOutput).toBe(
      "frontend/e2e/generated/fn-sts-02/navigates-to-dashboard-and-verifies-heading.spec.ts",
    );
    expect(result.risk).toBe("read-only");

    // Route action
    const gotoAction = result.actions.find((a) => a.kind === "goto");
    expect(gotoAction).toBeDefined();
    expect(gotoAction?.url).toBe("/dashboard");
    expect(gotoAction?.confidence).toBe("high");

    // Assertions
    const headingAssert = result.actions.find(
      (a) => a.kind === "assert" && a.assertionKind === "heading-visible",
    );
    expect(headingAssert).toBeDefined();
    expect(headingAssert?.assertionName).toBe("System Overview");

    const textAssert = result.actions.find(
      (a) => a.kind === "assert" && a.assertionKind === "text-visible",
    );
    expect(textAssert).toBeDefined();
    expect(textAssert?.assertionName).toBe("Active Nodes");
  });

  it("extracts API route, mutating risk, and cleanup requirements from Supertest / Jest backend test", () => {
    const sourceCode = `
      import request from "supertest";
      import app from "../app";

      describe("POST /api/students", () => {
        it("creates student profile", async () => {
          const res = await request(app)
            .post("/api/students")
            .send({ name: "Alice", grade: "A" });
          expect(res.status).toBe(201);
        });
      });
    `;

    const input: SourceAnalysisInput = {
      sourceCode,
      relativePath: "backend/test/students.e2e-spec.ts",
      testTitle: "creates student profile",
      functionId: "FN-STS-05",
      functionName: "Student Management",
      map: sampleMap,
    };

    const result = analyzeSourceForPlaywrightDraft(input);

    expect(result.risk).toBe("mutating");
    expect(result.actions.some((a) => a.kind === "goto" && a.url === "/api/students")).toBe(true);
    // Requires cleanup for mutating action
    expect(result.actions.some((a) => a.reviewRequired === true)).toBe(true);
  });

  it("suggests reusable login flow for authenticated functions", () => {
    const input: SourceAnalysisInput = {
      sourceCode: `test("protected user profile", () => {});`,
      relativePath: "backend/test/profile.spec.ts",
      testTitle: "protected user profile",
      functionId: "FN-STS-01",
      functionName: "Authentication",
      map: sampleMap,
    };

    const result = analyzeSourceForPlaywrightDraft(input);

    const flowAction = result.actions.find((a) => a.kind === "use-flow");
    expect(flowAction).toBeDefined();
    expect(flowAction?.flowId).toBe("login-as-uat-user");
    expect(flowAction?.confidence).toBe("high");
  });

  it("safely generates a review-required skeleton when source code is empty or ambiguous", () => {
    const input: SourceAnalysisInput = {
      sourceCode: "",
      relativePath: "unknown/test.ts",
      testTitle: "Blank Test Item",
      functionId: "FN-STS-99",
      map: sampleMap,
    };

    const result = analyzeSourceForPlaywrightDraft(input);

    expect(result.title).toBe("Blank Test Item");
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions.some((a) => a.reviewRequired === true)).toBe(true);
  });
});
