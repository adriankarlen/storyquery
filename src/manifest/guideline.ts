import type { Component, Doc, Docs } from "./types.js";

/**
 * Returns the guideline/usage doc associated with a component, if one exists.
 * It matches docs whose id begins with the component's id-derived prefix and
 * looks like a guideline page (e.g. "components-alert-guidelines-usage--docs"
 * for component "components-alert").
 */
export function guidelineFor(docs: Docs | undefined, c: Component): Doc | undefined {
  const all = docs?.docs;
  if (!all) return undefined;

  // Component ids look like "components-buttons-mainbutton"; guideline doc ids
  // look like "components-<name>-guidelines-usage--docs". Try a direct prefix
  // match first, then a looser name-based match.
  const prefix = `${c.id ?? ""}-guidelines`;
  if (c.id) {
    for (const d of Object.values(all)) {
      if (d.id?.startsWith(prefix)) return d;
    }
  }

  const name = (c.name ?? "").toLowerCase();
  if (name) {
    for (const d of Object.values(all)) {
      const id = (d.id ?? "").toLowerCase();
      if (id.includes("guidelines") && id.includes(name)) return d;
    }
  }
  return undefined;
}
