import { describe, expect, it } from "vitest";
import { buildCatalogFromConfig } from "../../../agent/src/runner";
import type { AgentConfig } from "../../../agent/src/types";

describe("Agent Runner & Catalog Builder", () => {
  it("builds clean TestProjectCatalog from AgentConfig", () => {
    const config: AgentConfig = {
      agentId: "agent-win-1",
      serverUrl: "http://localhost:3000",
      agentToken: "secret-token-32-chars-at-least-123",
      projects: [
        {
          id: "student-tracking",
          name: "Student Tracking System",
          presets: [
            {
              id: "cypress-e2e",
              name: "Cypress E2E",
              description: "Run Cypress tests",
              command: "npx",
              args: ["cypress", "run"],
              cwd: "E:\\project-monitor",
              timeoutSeconds: 300,
              metadata: { category: "automated", srsIds: [], risk: "safe", databaseTarget: "none" },
            },
          ],
        },
      ],
    };

    const catalog = buildCatalogFromConfig(config);
    expect(catalog.version).toBe("1.0.0");
    expect(catalog.projects).toHaveLength(1);
    expect(catalog.projects[0].presets[0].commandPreview).toBe("npx cypress run");
  });
});
