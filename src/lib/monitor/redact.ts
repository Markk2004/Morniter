const MAX_INPUT_LENGTH = 20_000;

// Test runners such as TypeScript and Nest emit terminal color controls. The
// execution log is rendered as text, so keep those controls out of persisted
// log lines instead of showing sequences such as "\u001b[96m" to users.
const ANSI_CSI_REGEX = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const ANSI_C1_CSI_REGEX = /\u009B[0-?]*[ -/]*[@-~]/g;
const ANSI_OSC_REGEX = /\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g;

export function stripTerminalControlSequences(input: string): string {
  return input
    .replace(ANSI_OSC_REGEX, "")
    .replace(ANSI_CSI_REGEX, "")
    .replace(ANSI_C1_CSI_REGEX, "");
}

const BEARER_REGEX = /authorization:\s*bearer\s+[^\s"'\\]+/gi;
const DB_URL_REGEX = /\b(?:postgres|postgresql|mysql|mongodb|redis|amqp):\/\/[^\s"'\\]+/gi;
const JSON_SECRET_KEY_REGEX = /"(?:api_key|token|password|secret|access_token|auth_token|private_key)":\s*"(?:[^"\\]|\\.)*"/gi;
const QUERY_SECRET_KEY_REGEX = /\b(api_key|token|password|secret|access_token|auth_token)=([^\s&"'\\]+)/gi;

export function redactText(input: string): string {
  if (!input) return "";

  let text = stripTerminalControlSequences(input);
  if (text.length > MAX_INPUT_LENGTH) {
    text = text.slice(0, MAX_INPUT_LENGTH) + "\n[TRUNCATED]";
  }

  // 1. Authorization: Bearer <token>
  text = text.replace(BEARER_REGEX, (match) => {
    const colonIndex = match.indexOf(":");
    const headerName = match.slice(0, colonIndex);
    return `${headerName}: [REDACTED]`;
  });

  // 2. Database connection URLs
  text = text.replace(DB_URL_REGEX, "[REDACTED_DATABASE_URL]");

  // 3. JSON secret key-values
  text = text.replace(JSON_SECRET_KEY_REGEX, (match) => {
    const colonIndex = match.indexOf(":");
    const keyName = match.slice(0, colonIndex);
    return `${keyName}:"[REDACTED]"`;
  });

  // 4. Query string secret key-values
  text = text.replace(QUERY_SECRET_KEY_REGEX, (_match, key) => `${key}=[REDACTED]`);

  return text;
}
