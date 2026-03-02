import { build } from "esbuild";
import { chmodSync, renameSync, existsSync } from "fs";

// Bundle MCP entry
await build({
  entryPoints: ["build/index.js"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "build/index.bundled.js",
  banner: { js: "#!/usr/bin/env node" },
  external: [],
});
renameSync("build/index.bundled.js", "build/index.js");
chmodSync("build/index.js", 0o755);

// Bundle HTTP server entry
if (existsSync("build/server.js")) {
  await build({
    entryPoints: ["build/server.js"],
    bundle: true,
    platform: "node",
    target: "node18",
    format: "esm",
    outfile: "build/server.bundled.js",
    banner: { js: "#!/usr/bin/env node" },
    external: [],
  });
  renameSync("build/server.bundled.js", "build/server.js");
  chmodSync("build/server.js", 0o755);
}

console.log("Build complete: build/index.js (MCP) + build/server.js (HTTP)");
