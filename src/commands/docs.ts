import { type Renderable, detailDoc, encode } from "../output/index.js";
import type { DocsResult } from "../output/index.js";
import { searchDocs } from "../search.js";
import {
  DEFAULT_QUERY_LIMIT,
  defineGlobalCommand,
  loadBundle,
  parseLimit,
  resolveFormat,
} from "./shared.js";

export const docsCommand = defineGlobalCommand({
  meta: { name: "docs", description: "Search documentation and guideline pages" },
  args: {
    term: { type: "positional", description: "search term", required: true },
    limit: {
      type: "string",
      description: "maximum results (0 = all)",
      default: String(DEFAULT_QUERY_LIMIT),
    },
  },
  async run({ args }) {
    const format = resolveFormat(args);
    const bundle = await loadBundle(args);

    const term = args.term;
    const limit = parseLimit(args.limit);

    const result: DocsResult = {
      term,
      docs: searchDocs(bundle.docs.docs ?? {}, term, limit).map((m) => detailDoc(m.doc)),
    };
    if (bundle.warnings.length > 0) result.warnings = bundle.warnings;

    const payload: Renderable = { kind: "docs", value: result };
    process.stdout.write(encode(format, payload));
  },
});
