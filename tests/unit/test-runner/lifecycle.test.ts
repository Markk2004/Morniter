import { describe, expect, it } from "vitest";
import {
  assertTransition,
  isActiveStatus,
  isTerminalStatus,
  InvalidJobTransitionError,
} from "@/lib/test-runner/lifecycle";

describe("test job lifecycle", () => {
  it.each(["queued", "claimed", "running", "cancel_requested"] as const)(
    "treats %s as active",
    (status) => expect(isActiveStatus(status)).toBe(true),
  );

  it.each(["passed", "failed", "cancelled", "timed_out", "agent_lost"] as const)(
    "treats %s as terminal",
    (status) => expect(isTerminalStatus(status)).toBe(true),
  );

  it.each([
    ["queued", "claimed"],
    ["queued", "cancelled"],
    ["claimed", "running"],
    ["claimed", "agent_lost"],
    ["running", "passed"],
    ["running", "failed"],
    ["running", "cancel_requested"],
    ["running", "timed_out"],
    ["running", "agent_lost"],
    ["cancel_requested", "cancelled"],
    ["cancel_requested", "agent_lost"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it("rejects a terminal job returning to running", () => {
    expect(() => assertTransition("passed", "running")).toThrow(
      InvalidJobTransitionError,
    );
  });
});
