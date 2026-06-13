import { type Renderable, encode, summarizeComponent } from "../output/index.js";
import type { ListResult } from "../output/index.js";
import { defineGlobalCommand, loadBundle, resolveFormat } from "./shared.js";

export const listCommand = defineGlobalCommand({
  meta: { name: "list", description: "List all components" },
  args: {
    filter: {
      type: "string",
      description: "case-insensitive substring filter on name/id",
      default: "",
    },
  },
  async run({ args }) {
    const format = resolveFormat(args);
    const bundle = await loadBundle(args);

    const needle = args.filter.trim().toLowerCase();
    const result: ListResult = { components: [] };
    for (const c of Object.values(bundle.components.components ?? {})) {
      const name = (c.name ?? "").toLowerCase();
      const id = (c.id ?? "").toLowerCase();
      if (needle && !name.includes(needle) && !id.includes(needle)) continue;
      result.components.push(summarizeComponent(c, 0));
    }
    result.components.sort((a, b) => a.name.localeCompare(b.name));
    if (bundle.warnings.length > 0) result.warnings = bundle.warnings;

    const payload: Renderable = { kind: "list", value: result };
    process.stdout.write(encode(format, payload));
  },
});
