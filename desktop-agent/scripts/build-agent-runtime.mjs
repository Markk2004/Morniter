import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)), "..");
const entry = path.join(projectRoot, "agent", "dist", "index.js");
const outputDirectory = path.join(projectRoot, "desktop-agent", "build", "agent");
const outfile = path.join(outputDirectory, "index.cjs");

try {
  await fs.access(entry);
} catch {
  throw new Error("agent/dist/index.js is missing. Run npm run agent:build first.");
}

await fs.rm(outputDirectory, { recursive: true, force: true });
await fs.mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: false,
  packages: "bundle",
  logLevel: "info",
});

console.log(`Bundled Local Agent runtime to ${path.relative(projectRoot, outfile)}`);
