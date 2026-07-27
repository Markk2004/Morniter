import { describe, expect, it, vi } from "vitest";
import { verifyGroupPassword } from "@/lib/auth/password";
import { resetServerEnvCache } from "@/lib/env/server";
import bcrypt from "bcryptjs";

describe("verifyGroupPassword", () => {
  const sampleHash = bcrypt.hashSync("correct horse battery staple", 10);

  it("accepts the matching bcrypt password", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", sampleHash);
    vi.stubEnv("SESSION_SIGNING_SECRET", "x".repeat(48));
    expect(await verifyGroupPassword("correct horse battery staple")).toBe(true);
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("rejects a different password", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", sampleHash);
    vi.stubEnv("SESSION_SIGNING_SECRET", "x".repeat(48));
    expect(await verifyGroupPassword("wrong password")).toBe(false);
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("rejects empty password or passwords over 256 characters before bcrypt", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", sampleHash);
    vi.stubEnv("SESSION_SIGNING_SECRET", "x".repeat(48));
    expect(await verifyGroupPassword("")).toBe(false);
    expect(await verifyGroupPassword("a".repeat(257))).toBe(false);
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });
});
