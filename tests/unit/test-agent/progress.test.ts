import { describe, expect, it } from "vitest";
import { createProgressParser } from "../../../agent/src/progress";

describe("Framework Progress Parsers", () => {
  it("parses Jest test summary line", () => {
    const parser = createProgressParser("npm run test:jest");
    const progress = parser.consume("stdout", [
      "Tests: 2 failed, 258 passed, 260 total",
    ]);
    expect(progress).toMatchObject({
      framework: "jest",
      completed: 260,
      total: 260,
      percentage: 100,
    });
  });

  it("parses Vitest summary line", () => {
    const parser = createProgressParser("npx vitest run");
    const progress = parser.consume("stdout", [
      "Tests  258 passed (258)",
    ]);
    expect(progress).toMatchObject({
      framework: "vitest",
      completed: 258,
      total: 258,
      percentage: 100,
    });
  });

  it("parses Cypress spec summary line", () => {
    const parser = createProgressParser("npx cypress run");
    const progress = parser.consume("stdout", [
      "Spec 2 of 5",
    ]);
    expect(progress).toMatchObject({
      framework: "cypress",
      completed: 2,
      total: 5,
      percentage: 40,
    });
  });

  it("falls back gracefully for unknown framework without inventing percentage", () => {
    const parser = createProgressParser("node custom-runner.js");
    const progress = parser.consume("stdout", ["running phase two"]);
    expect(progress).toMatchObject({
      framework: "unknown",
      completed: null,
      total: null,
      percentage: null,
    });
  });
});
