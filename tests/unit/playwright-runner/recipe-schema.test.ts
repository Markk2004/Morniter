import { describe, expect, it } from "vitest";
import { RecipeDraftSchema, ReusableFlowSchema } from "@/lib/playwright-runner/recipe-schema";

describe("Recipe Schema Validation", () => {
  it("accepts valid recipes with supported locators and actions", () => {
    const valid = {
      id: "recipe-login-01",
      title: "Login and verify dashboard",
      functionId: "FN-STS-01",
      output: "frontend/e2e/generated/fn-sts-01/login.spec.ts",
      risk: "read-only",
      actions: [
        { kind: "goto", url: "/login" },
        {
          kind: "fill",
          target: { kind: "label", text: "Username" },
          value: "STS_UAT_USERNAME",
          isSecretEnv: true,
        },
        {
          kind: "fill",
          target: { kind: "label", text: "Password" },
          value: "STS_UAT_PASSWORD",
          isSecretEnv: true,
        },
        {
          kind: "click",
          target: { kind: "role", role: "button", name: "Sign In" },
        },
        { kind: "expect-url", url: "/dashboard", matchType: "contains" },
        {
          kind: "expect-visible",
          target: { kind: "text", text: "Welcome" },
        },
      ],
    };

    expect(() => RecipeDraftSchema.parse(valid)).not.toThrow();
  });

  it("requires cleanupActions when risk is mutating", () => {
    const mutatingWithoutCleanup = {
      id: "recipe-create-user-01",
      title: "Create user",
      functionId: "FN-STS-02",
      output: "frontend/e2e/generated/fn-sts-02/create-user.spec.ts",
      risk: "mutating",
      actions: [
        { kind: "goto", url: "/users/new" },
        { kind: "click", target: { kind: "role", role: "button", name: "Submit" } },
      ],
    };

    expect(() => RecipeDraftSchema.parse(mutatingWithoutCleanup)).toThrow(/cleanupActions/i);
  });

  it("validates reusable flows", () => {
    const flow = {
      id: "flow-login-uat",
      name: "Login as UAT user",
      description: "Reusable authentication flow",
      actions: [
        { kind: "goto", url: "/login" },
        {
          kind: "fill",
          target: { kind: "label", text: "Username" },
          value: "STS_UAT_USERNAME",
          isSecretEnv: true,
        },
        {
          kind: "fill",
          target: { kind: "label", text: "Password" },
          value: "STS_UAT_PASSWORD",
          isSecretEnv: true,
        },
        {
          kind: "click",
          target: { kind: "role", role: "button", name: "Login" },
        },
      ],
    };

    expect(() => ReusableFlowSchema.parse(flow)).not.toThrow();
  });
});
