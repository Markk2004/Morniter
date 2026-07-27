const MAX_INPUT_LENGTH = 20_000;

const BEARER_REGEX = /authorization:\s*bearer\s+[^\s"'\\]+/gi;
const DB_URL_REGEX = /\b(?:postgres|postgresql|mysql|mongodb|redis|amqp):\/\/[^\s"'\\]+/gi;
const JSON_SECRET_KEY_REGEX = /"(?:api_key|token|password|secret|access_token|auth_token|private_key)":\s*"(?:[^"\\]|\\.)*"/gi;
const QUERY_SECRET_KEY_REGEX = /\b(api_key|token|password|secret|access_token|auth_token)=([^\s&"'\\]+)/gi;

export function redactText(input: string): string {
  if (!input) return "";

  let text = input;
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
