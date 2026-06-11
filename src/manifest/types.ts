// Models the Storybook design-system manifest files served at
// <base>/manifests/components.json and <base>/manifests/docs.json.
//
// The schema is versioned through the top-level "v" field. Parsing is
// intentionally lenient: arktype ignores undeclared keys by default, so the CLI
// keeps working as the upstream schema evolves. Validation only narrows the
// fields we care about; a version mismatch is surfaced as a warning, never an
// error.
import { type } from "arktype";

/**
 * The manifest schema version this package was written against. Manifests
 * reporting a different version are still parsed (best effort) but the mismatch
 * is surfaced to callers as a warning.
 */
export const SCHEMA_VERSION = 0;

// --- arktype schemas (single source of truth for runtime + static types) ---

/** The default value of a prop, when one is documented. */
const propDefault = type({
  "value?": "unknown",
});

/** The resolved type of a prop. */
const propType = type({
  "name?": "string",
  "raw?": "string",
  "value?": "unknown",
});

/** A single component property. */
const prop = type({
  "name?": "string",
  "description?": "string",
  "required?": "boolean",
  "defaultValue?": propDefault.or("null"),
  "type?": propType,
});

/** The react-docgen-typescript output for a component. */
const docgenInfo = type({
  "displayName?": "string",
  "description?": "string",
  "exportName?": "string",
  "filePath?": "string",
  "tags?": type.Record("string", "string"),
  "props?": type.Record("string", prop),
});

/** A single Storybook story for a component. */
const story = type({
  "id?": "string",
  "name?": "string",
  "snippet?": "string",
});

/** A single design-system component. */
const component = type({
  "id?": "string",
  "name?": "string",
  "path?": "string",
  "import?": "string",
  "description?": "string",
  "jsDocTags?": "unknown",
  "stories?": story.array(),
  "reactDocgenTypescript?": docgenInfo,
});

/** A single MDX documentation/guideline page. */
const doc = type({
  "id?": "string",
  "name?": "string",
  "path?": "string",
  "title?": "string",
  "content?": "string",
});

/** The parsed representation of components.json. */
const components = type({
  "v?": "number",
  "components?": type.Record("string", component),
});

/** The parsed representation of docs.json. */
const docs = type({
  "v?": "number",
  "docs?": type.Record("string", doc),
});

// --- Inferred static types (derived from the schemas above) ---

export type PropDefault = typeof propDefault.infer;
export type PropType = typeof propType.infer;
export type Prop = typeof prop.infer;
export type DocgenInfo = typeof docgenInfo.infer;
export type Story = typeof story.infer;
export type Component = typeof component.infer;
export type Doc = typeof doc.infer;
export type Components = typeof components.infer;
export type Docs = typeof docs.infer;

// --- Parsers ---

/** Decodes and validates components.json text. Lenient: never throws on extra keys. */
export function parseComponents(data: string): Components {
  const out = components(safeJson(data));
  if (out instanceof type.errors) {
    throw new Error(`parse components manifest: ${out.summary}`);
  }
  if (!out.components) out.components = {};
  return out;
}

/** Decodes and validates docs.json text. Lenient: never throws on extra keys. */
export function parseDocs(data: string): Docs {
  const out = docs(safeJson(data));
  if (out instanceof type.errors) {
    throw new Error(`parse docs manifest: ${out.summary}`);
  }
  if (!out.docs) out.docs = {};
  return out;
}

function safeJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch (err) {
    throw new Error(
      `parse manifest json: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// --- Version checks ---

/** Reports whether a components manifest version differs from the supported one. */
export function componentsVersionMismatch(c: Components): boolean {
  return (c.v ?? 0) !== SCHEMA_VERSION;
}

/** Reports whether a docs manifest version differs from the supported one. */
export function docsVersionMismatch(d: Docs): boolean {
  return (d.v ?? 0) !== SCHEMA_VERSION;
}

// --- Field renderers (ported from Go String() methods) ---

/** Renders a prop's default value as a readable string. */
export function propDefaultString(d: PropDefault | null | undefined): string {
  if (!d || d.value === undefined || d.value === null) return "";
  // The value may be a JSON string, number, or bool. Prefer a bare string.
  if (typeof d.value === "string") return d.value;
  return JSON.stringify(d.value);
}

/** Renders a prop type, preferring the raw TypeScript expression. */
export function propTypeString(t: PropType | undefined): string {
  if (!t) return "";
  if (t.raw) return t.raw;
  return t.name ?? "";
}
