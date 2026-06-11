import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node18",
  platform: "node",
  clean: true,
  sourcemap: true,
  minify: false,
  shims: false,
  banner: { js: "#!/usr/bin/env node" },
  define: {
    __STORYQUERY_VERSION__: JSON.stringify(pkg.version),
  },
});
