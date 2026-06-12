import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, "dist-test", "harness.cjs");

await build({
  entryPoints: [join(root, "test", "harness.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: out,
  // Run the real service modules against a stubbed `vscode` host API.
  alias: { vscode: join(root, "test", "vscode-stub.ts") },
  sourcemap: "inline",
  logLevel: "silent",
});

const r = spawnSync("node", [out], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
