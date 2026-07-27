import { describe, expect, it, vi } from "vitest";
import { fetchJson, ProviderError } from "@/lib/providers/request";
import { z } from "zod";

describe("fetchJson", () => {
  it("parses valid JSON response according to Zod schema", async () => {
    const mockSchema = z.object({ ok: z.boolean() });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const controller = new AbortController();
    const result = await fetchJson("https://api.example.com/test", {}, mockSchema, controller.signal);
    expect(result).toEqual({ ok: true });

    vi.unstubAllGlobals();
  });

  it("maps 401 response to unauthorized ProviderError", async () => {
    const mockSchema = z.object({ ok: z.boolean() });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });
    vi.stubGlobal("fetch", mockFetch);

    const controller = new AbortController();
    await expect(
      fetchJson("https://api.example.com/test", {}, mockSchema, controller.signal),
    ).rejects.toSatisfy((err: unknown) => err instanceof ProviderError && err.code === "unauthorized");

    vi.unstubAllGlobals();
  });

  it("maps 429 response to rate_limited ProviderError", async () => {
    const mockSchema = z.object({ ok: z.boolean() });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });
    vi.stubGlobal("fetch", mockFetch);

    const controller = new AbortController();
    await expect(
      fetchJson("https://api.example.com/test", {}, mockSchema, controller.signal),
    ).rejects.toSatisfy((err: unknown) => err instanceof ProviderError && err.code === "rate_limited");

    vi.unstubAllGlobals();
  });
});
