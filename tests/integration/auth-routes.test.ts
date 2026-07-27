// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { NextRequest } from "next/server";
import { resetServerEnvCache } from "@/lib/env/server";
import bcrypt from "bcryptjs";

describe("auth route handlers", () => {
  const secret = "a".repeat(48);
  const passwordHash = bcrypt.hashSync("super-secret-group-password", 10);

  it("handles login, session query, and logout flow", async () => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", passwordHash);
    vi.stubEnv("SESSION_SIGNING_SECRET", secret);

    // 1. Invalid login attempt
    const badReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "wrong-password" }),
    });
    const badRes = await loginPost(badReq);
    expect(badRes.status).toBe(401);
    const badJson = await badRes.json();
    expect(badJson.error).toBe("Invalid credentials");

    // 2. Successful login attempt
    const goodReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "super-secret-group-password" }),
    });
    const goodRes = await loginPost(goodReq);
    expect(goodRes.status).toBe(204);

    const setCookie = goodRes.cookies.get("project_monitor_session");
    expect(setCookie).toBeDefined();
    expect(setCookie?.value).toBeTruthy();

    // 3. Logout
    const logoutRes = await logoutPost();
    expect(logoutRes.status).toBe(204);
    expect(logoutRes.cookies.get("project_monitor_session")?.maxAge).toBe(0);

    vi.unstubAllEnvs();
    resetServerEnvCache();
  });
});
