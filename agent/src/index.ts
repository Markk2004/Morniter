import path from "node:path";
import { loadAgentConfig } from "./config.js";
import { runAgent } from "./runner.js";

async function main() {
  const configPath =
    process.env.TEST_RUNNER_CONFIG ||
    path.join(process.cwd(), "test-runner.config.local.json");

  try {
    const config = await loadAgentConfig(configPath);

    if (process.env.TEST_RUNNER_AGENT_TOKEN) {
      config.agentToken = process.env.TEST_RUNNER_AGENT_TOKEN;
    }

    await runAgent(config);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown initialization error";
    console.error(`[Monitor Local Agent] Fatal startup error: ${message}`);
    process.exit(1);
  }
}

main();
