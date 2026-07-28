import { describe, expect, it } from "vitest";
import { redactText } from "@/lib/monitor/redact";

describe("redactText", () => {
  it.each([
    ["Authorization: Bearer abc123def456", "Authorization: [REDACTED]"],
    ["authorization: Bearer xyz789", "authorization: [REDACTED]"],
    ["postgres://user:pass@host:5432/db", "[REDACTED_DATABASE_URL]"],
    ["postgresql://admin:secret123@db.example.com:5432/mydb?ssl=true", "[REDACTED_DATABASE_URL]"],
    ['{"api_key":"secret-value"}', '{"api_key":"[REDACTED]"}'],
    ['{"token":"my-secret-token"}', '{"token":"[REDACTED]"}'],
    ['{"password":"my-secret-password"}', '{"password":"[REDACTED]"}'],
    ["password=hunter2", "password=[REDACTED]"],
    ["api_key=supersecret123", "api_key=[REDACTED]"],
  ])("redacts %s correctly", (input, expected) => {
    expect(redactText(input)).toBe(expected);
  });

  it("truncates input larger than 20,000 characters before processing", () => {
    const longString = "A".repeat(30_000);
    const redacted = redactText(longString);
    expect(redacted.length).toBeLessThanOrEqual(20_100);
    expect(redacted).toContain("[TRUNCATED]");
  });

  it("removes terminal color control sequences", () => {
    expect(redactText("\u001b[96msrc/app.module.ts\u001b[0m:31:10")).toBe(
      "src/app.module.ts:31:10",
    );
  });
});
