import { describe, expect, it } from "vitest";
import {
  assertSafeTestTarget,
  resolveAndAssertSafeTestTarget,
} from "../../agent/src/test-target-policy";
import { RecipeDraftSchema } from "../../src/lib/playwright-runner/recipe-schema";

describe("Mutating Test Safety and Protection End-to-End", () => {
  const denylist = ["projectsts.com", "api.projectsts.com"];

  it("enforces schema-level cleanup on mutating recipes", () => {
    const validMutating = {
      id: "recipe-mut-valid",
      title: "Mutating Test with Cleanup",
      functionId: "FN-STS-01",
      output: "frontend/e2e/generated/fn-sts-01/mut.spec.ts",
      risk: "mutating",
      actions: [{ kind: "goto", url: "/students/new" }],
      cleanupActions: [{ kind: "goto", url: "/students/cleanup" }],
    };

    expect(() => RecipeDraftSchema.parse(validMutating)).not.toThrow();

    const invalidMutating = {
      id: "recipe-mut-invalid",
      title: "Mutating Test without Cleanup",
      functionId: "FN-STS-01",
      output: "frontend/e2e/generated/fn-sts-01/mut.spec.ts",
      risk: "mutating",
      actions: [{ kind: "goto", url: "/students/new" }],
    };

    expect(() => RecipeDraftSchema.parse(invalidMutating)).toThrow();
  });

  it("enforces production host rejection for mutating runs", () => {
    expect(() => assertSafeTestTarget("https://projectsts.com/app", "mutating", denylist)).toThrow(
      /production denylist/i,
    );
    expect(() => assertSafeTestTarget("https://api.projectsts.com/graphql", "mutating", denylist)).toThrow(
      /production denylist/i,
    );
    expect(() => assertSafeTestTarget("http://localhost:3000", "mutating", denylist)).not.toThrow();
  });

  it("resolves relative goto actions against target baseUrl and rejects production hosts", () => {
    const uatTarget = {
      baseUrl: "https://uat.projectsts.example",
      allowMutating: true,
    };
    const prodTarget = {
      baseUrl: "https://projectsts.com",
      allowMutating: true,
    };

    expect(() =>
      resolveAndAssertSafeTestTarget("/students/create", uatTarget, "mutating", denylist),
    ).not.toThrow();

    expect(() =>
      resolveAndAssertSafeTestTarget("/students/create", prodTarget, "mutating", denylist),
    ).toThrow(/production denylist/i);
  });
});
