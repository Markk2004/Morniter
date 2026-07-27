import { describe, expect, it } from "vitest";
import { limitDiagnostics } from "@/lib/monitor/diagnostic-lines";

describe("limitDiagnostics", () => {
  it("redacts secrets and caps the line count", () => {
    const lines = Array.from({ length: 25 }, (_, index) => ({
      id: `line-${index}`,
      stage: "build" as const,
      level: "error" as const,
      message: index === 0 ? "Authorization: Bearer secret-token" : `line ${index}`,
    }));

    const result = limitDiagnostics(lines);

    expect(result.lines).toHaveLength(20);
    expect(result.lines[0].message).not.toContain("secret-token");
    expect(result.truncated).toBe(true);
  });

  it("caps the redacted payload at 4096 bytes", () => {
    const result = limitDiagnostics([
      {
        id: "large",
        stage: "build",
        level: "error",
        message: "x".repeat(5000),
      },
    ]);

    expect(Buffer.byteLength(result.lines[0].message, "utf8")).toBeLessThanOrEqual(4096);
    expect(result.truncated).toBe(true);
  });
});
