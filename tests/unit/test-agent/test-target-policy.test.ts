import { describe, expect, it } from "vitest";
import {
  assertSafeTestTarget,
  isProductionHost,
  resolveAndAssertSafeTestTarget,
} from "../../../agent/src/test-target-policy";

describe("Test Target Security Policy", () => {
  const denylist = ["projectsts.com", "api.projectsts.com", "app.projectsts.com"];

  it("permits read-only tests on any valid target", () => {
    expect(() => assertSafeTestTarget("https://projectsts.com", "read-only", denylist)).not.toThrow();
    expect(() => assertSafeTestTarget("https://uat.projectsts.local", "read-only", denylist)).not.toThrow();
  });

  it("permits mutating tests on staging / UAT targets", () => {
    expect(() => assertSafeTestTarget("http://localhost:3000", "mutating", denylist)).not.toThrow();
    expect(() => assertSafeTestTarget("https://uat-app.internal.local", "mutating", denylist)).not.toThrow();
  });

  it("blocks mutating tests on production hosts and subdomains", () => {
    expect(isProductionHost("https://projectsts.com", denylist)).toBe(true);
    expect(isProductionHost("https://api.projectsts.com/v1", denylist)).toBe(true);
    expect(isProductionHost("https://sub.app.projectsts.com", denylist)).toBe(true);

    expect(() => assertSafeTestTarget("https://projectsts.com", "mutating", denylist)).toThrow(
      /production denylist/i,
    );
    expect(() => assertSafeTestTarget("https://api.projectsts.com/v1", "mutating", denylist)).toThrow(
      /production denylist/i,
    );
  });

  it("resolves relative URLs against target baseUrl and enforces denylist", () => {
    const target = {
      baseUrl: "https://uat.projectsts.example",
      allowMutating: true,
    };

    const resolved = resolveAndAssertSafeTestTarget("/students/create", target, "read-only", denylist);
    expect(resolved.href).toBe("https://uat.projectsts.example/students/create");

    expect(() =>
      resolveAndAssertSafeTestTarget(
        "/students/create",
        { baseUrl: "https://projectsts.com", allowMutating: true },
        "mutating",
        denylist,
      ),
    ).toThrow(/production denylist/i);
  });

  it("rejects mutating tests when allowMutating is false", () => {
    const target = {
      baseUrl: "https://uat.projectsts.example",
      allowMutating: false,
    };

    expect(() =>
      resolveAndAssertSafeTestTarget("/students/create", target, "mutating", denylist),
    ).toThrow(/does not allow mutating execution/i);

    // Read-only is still permitted
    expect(() =>
      resolveAndAssertSafeTestTarget("/students/list", target, "read-only", denylist),
    ).not.toThrow();
  });
});
