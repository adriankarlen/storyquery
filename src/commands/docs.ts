import { defineCommand } from "citty";
import { type Renderable, detailDoc, encode } from "../output/index.js";
import type { DocsResult } from "../output/index.js";
import { searchDocs } from "../search.js";
import { type GlobalOpts, globalArgs, loadBundle, resolveFormat } from "./shared.js";

const DEFAULT_QUERY_LIMIT = 10;

export const docsCommand = defineCommand({
  meta: { name: "docs", description: "Search documentation and guideline pages" },
  args: {
    term: { type: "positional", description: "search term", required: true },
    limit: {
      type: "string",
      description: "maximum results (0 = all)",
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

    const result: DocsResult = {
      term,
      docs: searchDocs(bundle.docs.docs ?? {}, term, limit).map((m) => detailDoc(m.doc)),
    };
    if (bundle.warnings.length > 0) result.warnings = bundle.warnings;

    const payload: Renderable = { kind: "docs", value: result };
    process.stdout.write(encode(format, payload));
  },
});
