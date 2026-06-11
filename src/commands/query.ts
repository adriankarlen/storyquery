import { defineCommand } from "citty";
import { type Renderable, encode, summarizeComponent } from "../output/index.js";
import type { QueryResult } from "../output/index.js";
import { searchComponents, searchDocs } from "../search.js";
import { type GlobalOpts, globalArgs, loadBundle, resolveFormat } from "./shared.js";

const DEFAULT_QUERY_LIMIT = 10;

export const queryCommand = defineCommand({
  meta: { name: "query", description: "Search components and docs for a term" },
  args: {
    term: { type: "positional", description: "search term", required: true },
    limit: {
      type: "string",
      description: "maximum results per category (0 = all)",
      default: String(DEFAULT_QUERY_LIMIT),
    },
    ...globalArgs,
  },
  async run({ args }) {
    const opts = args as unknown as GlobalOpts;
    const format = resolveFormat(opts);
    const bundle = await loadBundle(opts);

    const term = args.term;
    const limit = Number.parseInt(args.limit, 10) || 0;

    const result: QueryResult = {
      term,
      components: searchComponents(bundle.components.components ?? {}, term, limit).map((m) =>
        summarizeComponent(m.component, m.score),
      ),
      docs: searchDocs(bundle.docs.docs ?? {}, term, limit).map((m) => ({
        id: m.doc.id ?? "",
        title: m.doc.title ?? "",
        score: m.score,
      })),
    };
    if (bundle.warnings.length > 0) result.warnings = bundle.warnings;

    const payload: Renderable = { kind: "query", value: result };
    process.stdout.write(encode(format, payload));
  },
});
