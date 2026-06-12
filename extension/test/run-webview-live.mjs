import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, "dist-test", "webview-live.cjs");

await build({
  entryPoints: [join(root, "test", "webview-live.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: out,
  alias: { vscode: join(root, "test", "vscode-stub.ts") },
  external: ["esbuild"],
  sourcemap: "inline",
  logLevel: "silent",
});

const r = spawnSync("node", [out], {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});
process.exit(r.status ?? 1);
