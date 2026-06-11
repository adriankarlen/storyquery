// Renders query results in either machine-readable JSON (the default,
// agent-first contract) or human-friendly text.
import type {
  ComponentDetail,
  DocsResult,
  ListResult,
  QueryResult,
} from "./types.js";
import { renderDetail, renderDocs, renderList, renderQuery } from "./text.js";

export * from "./types.js";

/** The rendering style. */
export type Format = "json" | "text";

/**
 * A tagged payload so text rendering can dispatch to the right renderer with
 * full type safety. JSON output ignores the tag and serializes `value`.
 */
export type Renderable =
  | { kind: "query"; value: QueryResult }
  | { kind: "list"; value: ListResult }
  | { kind: "detail"; value: ComponentDetail }
  | { kind: "docs"; value: DocsResult };

/** Validates and normalizes a format string. */
export function parseFormat(s: string): Format {
  switch (s.trim().toLowerCase()) {
    case "json":
      return "json";
    case "text":
      return "text";
    default:
      throw new Error(`invalid format "${s}" (want json or text)`);
  }
}

/** Renders a payload in the requested format. */
export function encode(format: Format, payload: Renderable): string {
  if (format === "json") return `${JSON.stringify(payload.value, null, 2)}\n`;
  switch (payload.kind) {
    case "query":
      return renderQuery(payload.value);
    case "list":
      return renderList(payload.value);
    case "detail":
      return renderDetail(payload.value);
    case "docs":
      return renderDocs(payload.value);
  }
}
