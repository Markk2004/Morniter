import { describe, expect, it } from "vitest";
import { resolveAndAssertSafeTestTarget } from "../../../agent/src/test-target-policy";

describe("Workspace Draft Risk Metadata Enforcement (P0)", () => {
  const denylist = ["projectsts.com", "api.projectsts.com"];
  const targetWithMutatingFalse = {
    id: "projectsts-readonly",
    label: "ProjectSTS Read-Only Target",
    baseUrl: "https://readonly.projectsts.example",
    allowMutating: false,
  };
  const targetWithMutatingTrue = {
    id: "projectsts-uat",
    label: "ProjectSTS UAT Target",
    baseUrl: "https://uat.projectsts.example",
    allowMutating: true,
  };
  const prodTarget = {
    id: "projectsts-prod",
    label: "ProjectSTS Production",
    baseUrl: "https://projectsts.com",
    allowMutating: true,
  };

  it("permits read-only workspace code on read-only targets", () => {
    expect(() =>
      resolveAndAssertSafeTestTarget("/students/list", targetWithMutatingFalse, "read-only", denylist),
    ).not.toThrow();
  });

  it("rejects mutating workspace code on read-only targets even without try/finally", () => {
    // Code doesn't have try/finally, but has risk: 'mutating' metadata
    expect(() =>
      resolveAndAssertSafeTestTarget("/students/create", targetWithMutatingFalse, "mutating", denylist),
    ).toThrow(/does not allow mutating execution/i);
  });

  it("rejects mutating workspace code on production denylisted targets even without try/finally", () => {
    expect(() =>
      resolveAndAssertSafeTestTarget("/students/create", prodTarget, "mutating", denylist),
    ).toThrow(/production denylist/i);
  });

  it("permits mutating workspace code on allowed UAT targets", () => {
    const resolved = resolveAndAssertSafeTestTarget("/students/create", targetWithMutatingTrue, "mutating", denylist);
    expect(resolved.href).toBe("https://uat.projectsts.example/students/create");
  });
});
