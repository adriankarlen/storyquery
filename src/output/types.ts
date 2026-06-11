// Stable view models — the JSON contract (agent-first). Optional fields are
// omitted from JSON when empty to match the Go `omitempty` behavior.
import type { Component, Doc } from "../manifest/types.js";
import { propDefaultString, propTypeString } from "../manifest/types.js";

export interface ComponentSummary {
  id: string;
  name: string;
  description?: string;
  import?: string;
  props: number;
  stories: number;
  score?: number;
}

export interface DocSummary {
  id: string;
  title: string;
  score?: number;
}

export interface QueryResult {
  term: string;
  components: ComponentSummary[];
  docs: DocSummary[];
  warnings?: string[];
}

export interface PropDetail {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description?: string;
}

export interface StoryDetail {
  id: string;
  name: string;
  snippet?: string;
}

export interface DocDetail {
  id: string;
  title: string;
  content: string;
  warnings?: string[];
}

export interface ComponentDetail {
  id: string;
  name: string;
  description?: string;
  import?: string;
  path?: string;
  sourceFile?: string;
  tags?: Record<string, string>;
  props: PropDetail[];
  stories: StoryDetail[];
  guideline?: DocDetail;
  warnings?: string[];
}

export interface DocsResult {
  term: string;
  docs: DocDetail[];
  warnings?: string[];
}

export interface ListResult {
  components: ComponentSummary[];
  warnings?: string[];
}

// --- Builders ---

/** Builds a compact summary (score optional; omitted when 0). */
export function summarizeComponent(c: Component, score: number): ComponentSummary {
  // Field order mirrors the original JSON contract: id, name, description,
  // import, props, stories, score.
  const summary = { id: c.id ?? "", name: c.name ?? "" } as ComponentSummary;
  if (c.description) summary.description = c.description;
  if (c.import) summary.import = c.import;
  summary.props = Object.keys(c.reactDocgenTypescript?.props ?? {}).length;
  summary.stories = c.stories?.length ?? 0;
  if (score) summary.score = score;
  return summary;
}

/** Builds the full detail view, attaching a guideline doc if set. */
export function detailComponent(c: Component, guideline?: Doc): ComponentDetail {
  const docgen = c.reactDocgenTypescript;
  const detail: ComponentDetail = {
    id: c.id ?? "",
    name: c.name ?? "",
    props: [],
    stories: [],
  };
  if (c.description) detail.description = c.description;
  if (c.import) detail.import = c.import;
  if (c.path) detail.path = c.path;
  if (docgen?.filePath) detail.sourceFile = docgen.filePath;

  const tags = mergeTags(docgen?.tags);
  if (tags) detail.tags = tags;

  for (const p of Object.values(docgen?.props ?? {})) {
    const prop: PropDetail = {
      name: p.name ?? "",
      type: propTypeString(p.type),
      required: p.required ?? false,
    };
    const def = propDefaultString(p.defaultValue);
    if (def) prop.default = def;
    if (p.description) prop.description = p.description;
    detail.props.push(prop);
  }
  // Stable prop order by name.
  detail.props.sort((a, b) => a.name.localeCompare(b.name));

  for (const s of c.stories ?? []) {
    const story: StoryDetail = { id: s.id ?? "", name: s.name ?? "" };
    if (s.snippet) story.snippet = s.snippet;
    detail.stories.push(story);
  }

  if (guideline) {
    detail.guideline = {
      id: guideline.id ?? "",
      title: guideline.title ?? "",
      content: guideline.content ?? "",
    };
  }
  return detail;
}

/** Builds a full doc view. */
export function detailDoc(d: Doc): DocDetail {
  return { id: d.id ?? "", title: d.title ?? "", content: d.content ?? "" };
}

/** Combines tag maps, returning undefined when all are empty. */
function mergeTags(
  ...sources: (Record<string, string> | undefined)[]
): Record<string, string> | undefined {
  const merged: Record<string, string> = {};
  for (const src of sources) {
    if (!src) continue;
    for (const [k, v] of Object.entries(src)) {
      if (v) merged[k] = v;
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}
