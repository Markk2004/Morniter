export function extractHostname(urlOrHost: string): string {
  try {
    const parsed = new URL(urlOrHost.startsWith("http") ? urlOrHost : `http://${urlOrHost}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return urlOrHost.toLowerCase().split("/")[0].split(":")[0];
  }
}

export function isProductionHost(urlOrHost: string, denylist: string[] = []): boolean {
  if (!denylist || denylist.length === 0) {
    return false;
  }
  const hostname = extractHostname(urlOrHost);
  return denylist.some((denied) => {
    const cleanDenied = denied.trim().toLowerCase();
    return hostname === cleanDenied || hostname.endsWith(`.${cleanDenied}`);
  });
}

export function assertSafeTestTarget(
  targetUrl: string | undefined,
  risk: "read-only" | "mutating",
  denylist: string[] = [],
): void {
  if (risk !== "mutating") {
    return;
  }

  if (!targetUrl) {
    return;
  }

  if (isProductionHost(targetUrl, denylist)) {
    const host = extractHostname(targetUrl);
    throw new Error(`Execution rejected: target host '${host}' is on the production denylist for mutating tests`);
  }
}

export interface TestTargetResolutionContext {
  baseUrl?: string;
  allowMutating?: boolean;
}

export function resolveAndAssertSafeTestTarget(
  actionUrl: string,
  target?: TestTargetResolutionContext,
  risk: "read-only" | "mutating" = "read-only",
  denylist: string[] = [],
): URL {
  let resolved: URL;
  try {
    if (actionUrl.startsWith("http://") || actionUrl.startsWith("https://")) {
      resolved = new URL(actionUrl);
    } else if (target?.baseUrl) {
      resolved = new URL(actionUrl, target.baseUrl);
    } else {
      resolved = new URL(actionUrl, "http://localhost:3000");
    }
  } catch (err) {
    throw new Error(`Invalid target URL '${actionUrl}': ${err instanceof Error ? err.message : String(err)}`);
  }

  if (risk === "mutating") {
    if (target && target.allowMutating === false) {
      throw new Error(`Execution rejected: target does not allow mutating execution`);
    }
    assertSafeTestTarget(resolved.href, "mutating", denylist);
  }

  return resolved;
}
