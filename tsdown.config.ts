import { defineConfig } from "tsdown";

import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  platform: "node",
  fixedExtension: false,
  clean: true,
  sourcemap: true,
  minify: false,
  shims: false,
  banner: { js: "#!/usr/bin/env node" },
  define: {
    __STORYQUERY_VERSION__: JSON.stringify(pkg.version),
  },
});
