const SECRET_PATTERNS = [
  /bearer\s+[a-zA-Z0-9._\--]+/gi,
  /(password|secret|token|api_key|apikey|auth_hash)\s*[:=]\s*["']?[^"'\s]+["']?/gi,
];

export function redactLogLine(line: string, extraSecrets: string[] = []): string {
  let result = line;

  for (const secret of extraSecrets) {
    if (secret && secret.trim().length >= 4) {
      result = result.replaceAll(secret, "[REDACTED]");
    }
  }

  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const parts = match.split(/[:=]/);
      if (parts.length === 2) {
        return `${parts[0]}=[REDACTED]`;
      }
      if (match.toLowerCase().startsWith("bearer ")) {
        return "Bearer [REDACTED]";
      }
      return "[REDACTED]";
    });
  }

  return result;
}

export function redactText(line: string, extraSecrets: string[] = []): string {
  return redactLogLine(line, extraSecrets);
}
