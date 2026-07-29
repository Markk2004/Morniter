import type {
  FailureAnalysis,
  TestJobStatus,
  TestLogLine,
} from "./types";

export interface FailureAnalysisInput {
  status: TestJobStatus;
  exitCode?: number | null;
  error?: string;
  lines: TestLogLine[];
}

interface FailureRule {
  category: FailureAnalysis["category"];
  title: string;
  cause: string;
  fixLocation: string;
  recommendation: string;
  confidence: FailureAnalysis["confidence"];
  matches: (input: FailureAnalysisInput, text: string) => boolean;
}

const CONTROL_SEQUENCE_PATTERN = /[\u001b\u009b][[\]()#;?]*(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TXZcf-nq-uy=><~]))/g;

const RULES: FailureRule[] = [
  {
    category: "timeout",
    title: "Test execution timed out",
    cause: "The test process did not finish within the configured time limit.",
    fixLocation: "Test command, timeout setting, or the test step that is hanging",
    recommendation: "Inspect the last log line, then increase the timeout only if the test is expected to take longer.",
    confidence: "high",
    matches: (input, text) => input.status === "timed_out" || /timed?\s*out|timeout|time limit|deadline exceeded/i.test(text),
  },
  {
    category: "agent",
    title: "Test agent became unavailable",
    cause: "The local test agent stopped sending heartbeats before the job completed.",
    fixLocation: "Local test agent process, network connection, or agent configuration",
    recommendation: "Check that the agent is running and connected, then rerun the test.",
    confidence: "high",
    matches: (input, text) => input.status === "agent_lost" || /agent.*(?:lost|offline|heartbeat|lease)|heartbeat.*(?:lost|failed)|lease expired/i.test(text),
  },
  {
    category: "dependency",
    title: "Test dependency is missing",
    cause: "The command could not load a required module or package.",
    fixLocation: "package.json, lockfile, or the agent dependency installation",
    recommendation: "Install the missing package in the test project and run the test again.",
    confidence: "high",
    matches: (_, text) => /cannot find module|module not found|could not resolve|no such file or directory|missing (?:dependency|package)|package .* not found/i.test(text),
  },
  {
    category: "environment",
    title: "Test environment configuration is invalid",
    cause: "A required environment variable or configuration value is missing or invalid.",
    fixLocation: ".env.local, Vercel environment variables, or the test preset configuration",
    recommendation: "Check the required environment variables and make sure the agent has received the current values.",
    confidence: "high",
    matches: (_, text) => /not defined|undefined|environment variable|missing (?:environment|env|configuration)|invalid (?:environment|configuration)|config(?:uration)? .*\b(?:missing|invalid)\b/i.test(text),
  },
  {
    category: "connection",
    title: "External service connection failed",
    cause: "The test could not connect to a required service such as Redis or an API.",
    fixLocation: "Service URL/token, network access, or the test setup that creates the connection",
    recommendation: "Check the service status and connection settings, then rerun the test.",
    confidence: "high",
    matches: (_, text) => /econnrefused|econnreset|etimedout|connection (?:refused|reset|failed|error)|network error|(?:redis).*(?:error|fail|unavailable|connect|timeout|refused)|(?:error|fail|unavailable|connect|timeout|refused).*redis/i.test(text),
  },
  {
    category: "permission",
    title: "Permission denied during test execution",
    cause: "The test process does not have access to a required file, command, or service.",
    fixLocation: "File permissions, service credentials, or the account used by the test agent",
    recommendation: "Verify the agent account and credentials have the required access without granting broader permissions than needed.",
    confidence: "high",
    matches: (_, text) => /permission denied|access denied|eacces|eperm|forbidden/i.test(text),
  },
  {
    category: "assertion",
    title: "Test assertion failed",
    cause: "The actual result did not match the expected result in the test.",
    fixLocation: "The failing test assertion and the application behavior it checks",
    recommendation: "Compare the expected and received values, then fix the application or update the assertion if the requirement changed.",
    confidence: "high",
    matches: (_, text) => /assert(?:ion|ed)?|expected.*received|received.*expected|to(?:be|equal|have|contain)\b|snapshot.*fail|test failed|failed test/i.test(text),
  },
  {
    category: "syntax",
    title: "Test or source syntax error",
    cause: "The runner could not parse a test or source file.",
    fixLocation: "The file and line named near the syntax or parse error",
    recommendation: "Open the referenced file, fix the syntax, and rerun the same test command.",
    confidence: "high",
    matches: (_, text) => /syntaxerror|syntax error|unexpected token|parse error|failed to parse|invalid or unexpected token/i.test(text),
  },
];

function cleanText(value: string): string {
  return value.replace(CONTROL_SEQUENCE_PATTERN, "").replace(/\s+/g, " ").trim();
}

function clipEvidence(value: string): string {
  const cleaned = cleanText(value);
  return cleaned.length > 240 ? `${cleaned.slice(0, 237)}...` : cleaned;
}

function uniqueEvidence(values: string[]): string[] {
  return Array.from(new Set(values.map(clipEvidence).filter(Boolean))).slice(0, 3);
}

export function analyzeTestFailure(input: FailureAnalysisInput): FailureAnalysis {
  const cleanedError = input.error ? clipEvidence(input.error) : "";
  const cleanedLines = input.lines
    .map((line) => ({ line, message: clipEvidence(line.message) }))
    .filter(({ message }) => Boolean(message));

  for (const rule of RULES) {
    const matchingLines = cleanedLines
      .filter(({ message }) => rule.matches(input, message))
      .map(({ message }) => message);
    const errorMatches = cleanedError && rule.matches(input, cleanedError) ? [cleanedError] : [];
    const evidence = uniqueEvidence([...errorMatches, ...matchingLines]);

    if (rule.matches(input, `${cleanedError} ${cleanedLines.map(({ message }) => message).join(" ")}`)) {
      return {
        category: rule.category,
        title: rule.title,
        cause: rule.cause,
        fixLocation: rule.fixLocation,
        recommendation: rule.recommendation,
        evidence: evidence.length > 0 ? evidence : uniqueEvidence([cleanedError, `Process exited with code ${input.exitCode ?? "an unknown code"}.`]),
        confidence: rule.confidence,
      };
    }
  }

  const fallbackEvidence = uniqueEvidence([
    cleanedError,
    input.exitCode === null || input.exitCode === undefined
      ? "The process did not provide an exit code."
      : `Process exited with code ${input.exitCode}.`,
    ...cleanedLines.map(({ message }) => message),
  ]);

  return {
    category: "unknown",
    title: "Test failed without a recognized error pattern",
    cause: "The available output does not match a specific failure rule.",
    fixLocation: "The first error or stderr line in the execution log",
    recommendation: "Inspect the first error in the log, correct the referenced file or service, and rerun the test.",
    evidence: fallbackEvidence,
    confidence: "low",
  };
}
