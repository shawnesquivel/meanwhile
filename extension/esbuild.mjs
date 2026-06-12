import { build, context } from "esbuild";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "src");
const DIST = resolve(HERE, "dist");
const watch = process.argv.includes("--watch");

/**
 * Copy every `*.asset.*` template from src/ to the mirrored path under dist/.
 * Asset templates (the injected webview block, the CLI status-line script, the
 * Codex wrapper) ship raw — placeholders are substituted at patch time — so
 * they must NOT go through esbuild. We mirror the tree so the bundled adapter's
 * relative `resolveAsset(dist, "adapters/...", name)` finds them.
 */
function copyAssets() {
  if (!existsSync(SRC)) return;
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (!/\.asset\.[a-z0-9]+$/i.test(entry)) continue;
      const rel = relative(SRC, p);
      const out = join(DIST, rel);
      mkdirSync(dirname(out), { recursive: true });
      cpSync(p, out);
    }
  };
  walk(SRC);
}

function writeBuildInfo() {
  mkdirSync(DIST, { recursive: true });
  writeFileSync(
    join(DIST, "buildinfo.json"),
    JSON.stringify({ builtAt: new Date().toISOString() }, null, 2),
  );
}

const options = {
  entryPoints: [join(SRC, "extension.ts")],
  bundle: true,
  outfile: join(DIST, "extension.js"),
  platform: "node",
  format: "cjs",
  target: "node18",
  // vscode is provided by the host at runtime; never bundle it.
  external: ["vscode"],
  sourcemap: true,
  minify: !watch,
  logLevel: "info",
};

async function run() {
  if (watch) {
    const ctx = await context({
      ...options,
      plugins: [
        {
          name: "meanwhile-assets",
          setup(b) {
            b.onEnd(() => {
              copyAssets();
              writeBuildInfo();
            });
          },
        },
      ],
    });
    await ctx.watch();
    console.log("[meanwhile] watching…");
  } else {
    await build(options);
    copyAssets();
    writeBuildInfo();
    console.log("[meanwhile] build complete → dist/extension.js");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
