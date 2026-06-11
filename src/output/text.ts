// Human-friendly text rendering for the known view models.
import type {
  ComponentDetail,
  DocsResult,
  ListResult,
  QueryResult,
} from "./types.js";

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return i >= 0 ? s.slice(0, i) : s;
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function warnings(lines: string[] | undefined): string {
  return (lines ?? []).map((m) => `! ${m}\n`).join("");
}

export function renderQuery(r: QueryResult): string {
  let out = warnings(r.warnings);
  out += `Query: ${r.term}\n`;
  out += `\nComponents (${r.components.length}):\n`;
  for (const c of r.components) {
    out += `  ${pad(c.name, 28)} ${c.id}\n`;
    if (c.description) out += `      ${firstLine(c.description)}\n`;
  }
  out += `\nDocs (${r.docs.length}):\n`;
  for (const d of r.docs) {
    out += `  ${pad(d.title, 28)} ${d.id}\n`;
  }
  return out;
}

export function renderList(r: ListResult): string {
  let out = warnings(r.warnings);
  for (const c of r.components) {
    out += `${pad(c.name, 32)} ${c.id}\n`;
  }
  return out;
}

export function renderDetail(d: ComponentDetail): string {
  let out = warnings(d.warnings);
  out += `${d.name} (${d.id})\n`;
  if (d.description) out += `\n${d.description}\n`;
  if (d.tags && Object.keys(d.tags).length > 0) {
    out += `\nTags:\n`;
    for (const [k, v] of Object.entries(d.tags)) {
      out += `  @${k} ${firstLine(v)}\n`;
    }
  }
  if (d.import) out += `\nImport:\n  ${d.import}\n`;
  if (d.sourceFile) out += `Source: ${d.sourceFile}\n`;
  out += `\nProps (${d.props.length}):\n`;
  for (const p of d.props) {
    const req = p.required ? " (required)" : "";
    const def = p.default ? ` = ${p.default}` : "";
    out += `  ${p.name}: ${p.type}${def}${req}\n`;
    if (p.description) out += `      ${firstLine(p.description)}\n`;
  }
  out += `\nStories (${d.stories.length}):\n`;
  for (const s of d.stories) {
    out += `  ${s.name}\n`;
  }
  if (d.guideline) {
    out += `\nGuideline: ${d.guideline.title}\n\n${d.guideline.content}\n`;
  }
  return out;
}

export function renderDocs(r: DocsResult): string {
  let out = warnings(r.warnings);
  out += `Query: ${r.term}\n`;
  for (const d of r.docs) {
    out += `\n=== ${d.title} (${d.id}) ===\n${d.content}\n`;
  }
  return out;
}
