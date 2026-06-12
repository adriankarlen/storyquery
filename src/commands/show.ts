import { defineCommand } from "citty";

import { guidelineFor } from "../manifest/guideline.js";
import { AmbiguousError, NotFoundError } from "../manifest/service.js";
import { type Renderable, detailComponent, encode } from "../output/index.js";
import { bestComponent, searchComponents } from "../search.js";
import { type GlobalOpts, globalArgs, loadBundle, resolveFormat } from "./shared.js";

export const showCommand = defineCommand({
  meta: { name: "show", description: "Show full detail for a single component" },
  args: {
    term: { type: "positional", description: "component term or id", required: true },
    ...globalArgs,
  },
  async run({ args }) {
    const opts = args as unknown as GlobalOpts;
    const format = resolveFormat(opts);
    const bundle = await loadBundle(opts);

    const term = args.term;
    const comps = bundle.components.components ?? {};
    const result = bestComponent(comps, term);

    if (result.kind === "none") {
      throw new NotFoundError(`"${term}": no match found`);
    }
    if (result.kind === "ambiguous") {
      const candidates = searchComponents(comps, term, 5).map((m) => m.component.id ?? "");
      throw new AmbiguousError(
        `"${term}": ambiguous match; candidates: ${candidates.join(", ")}`,
        candidates,
      );
    }

    const component = result.match.component;
    const guideline = guidelineFor(bundle.docs, component);
    const detail = detailComponent(component, guideline);
    if (bundle.warnings.length > 0) detail.warnings = bundle.warnings;

    const payload: Renderable = { kind: "detail", value: detail };
    process.stdout.write(encode(format, payload));
  },
});
