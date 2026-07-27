import type { ProviderErrorCode } from "@/lib/monitor/types";
import { type ZodType } from "zod";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  schema: ZodType<T>,
  callerSignal?: AbortSignal,
  timeoutMs = 8000,
): Promise<T> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  const onCallerAbort = () => {
    timeoutController.abort();
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timer);
      throw new ProviderError("timeout", "Request cancelled by caller");
    }
    callerSignal.addEventListener("abort", onCallerAbort);
  }

  try {
    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    const response = await fetch(url, {
      ...init,
      headers,
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ProviderError("unauthorized", `Upstream unauthorized (${response.status})`);
      }
      if (response.status === 429) {
        throw new ProviderError("rate_limited", "Upstream rate limit exceeded");
      }
      throw new ProviderError(
        "upstream_error",
        `Upstream request failed with status ${response.status}`,
      );
    }

    const data = await response.json();
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new ProviderError(
        "upstream_error",
        "Upstream response format did not match expected schema",
      );
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      const timeoutLabel =
        timeoutMs % 1000 === 0 ? `${timeoutMs / 1000}s` : `${timeoutMs}ms`;
      throw new ProviderError(
        "timeout",
        `Provider request timed out after ${timeoutLabel}`,
      );
    }

    throw new ProviderError(
      "upstream_error",
      error instanceof Error ? error.message : "Provider request failed",
    );
  } finally {
    clearTimeout(timer);
    if (callerSignal) {
      callerSignal.removeEventListener("abort", onCallerAbort);
    }
  }
}
