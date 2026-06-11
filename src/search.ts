// Ranks components and docs against a search term.
import type { Component, Doc } from "./manifest/types.js";

// Score tiers. Higher is a better match.
const SCORE_EXACT_NAME = 1000;
const SCORE_EXACT_ID = 900;
const SCORE_NAME_PREFIX = 700;
const SCORE_ID_SUBSTR = 500;
const SCORE_NAME_SUBSTR = 450;
const SCORE_FUZZY = 100; // base; fuzzy adds a density bonus on top
const SCORE_NO_MATCH = 0;

/** A component paired with its relevance score. */
export interface ComponentMatch {
  component: Component;
  score: number;
}

/** A doc paired with its relevance score. */
export interface DocMatch {
  doc: Doc;
  score: number;
}

/** The outcome of resolving a term to a single best component. */
export type BestComponentResult =
  | { kind: "found"; match: ComponentMatch }
  | { kind: "ambiguous"; match: ComponentMatch }
  | { kind: "none" };

/**
 * Ranks all components against term, returning matches with a positive score
 * sorted best-first. limit <= 0 returns all matches.
 */
export function searchComponents(
  comps: Record<string, Component>,
  term: string,
  limit: number,
): ComponentMatch[] {
  const q = term.trim().toLowerCase();
  const out: ComponentMatch[] = [];
  for (const component of Object.values(comps)) {
    const score = scoreComponent(component, q);
    if (score > SCORE_NO_MATCH) out.push({ component, score });
  }
  out.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return (a.component.name ?? "").localeCompare(b.component.name ?? "");
  });
  return cap(out, limit);
}

/** Ranks all docs against term, matching on title, name, id, and content. */
export function searchDocs(
  docs: Record<string, Doc>,
  term: string,
  limit: number,
): DocMatch[] {
  const q = term.trim().toLowerCase();
  const out: DocMatch[] = [];
  for (const doc of Object.values(docs)) {
    const score = scoreDoc(doc, q);
    if (score > SCORE_NO_MATCH) out.push({ doc, score });
  }
  out.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return (a.doc.title ?? "").localeCompare(b.doc.title ?? "");
  });
  return cap(out, limit);
}

/**
 * Resolves term to a single best component. A direct id or exact name always
 * wins outright; multiple tied top matches are ambiguous.
 */
export function bestComponent(
  comps: Record<string, Component>,
  term: string,
): BestComponentResult {
  const matches = searchComponents(comps, term, 0);
  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) return { kind: "found", match: matches[0]! };
  // A unique top score is a clear winner.
  if (matches[0]!.score > matches[1]!.score) {
    return { kind: "found", match: matches[0]! };
  }
  return { kind: "ambiguous", match: matches[0]! };
}

function scoreComponent(c: Component, q: string): number {
  if (q === "") return SCORE_NO_MATCH;
  const name = (c.name ?? "").toLowerCase();
  const id = (c.id ?? "").toLowerCase();

  if (name === q) return SCORE_EXACT_NAME;
  if (id === q) return SCORE_EXACT_ID;
  if (name.startsWith(q)) return SCORE_NAME_PREFIX;
  if (id.includes(q)) return SCORE_ID_SUBSTR;
  if (name.includes(q)) return SCORE_NAME_SUBSTR;

  const nameFuzzy = fuzzyScore(name, q);
  if (nameFuzzy !== null) return SCORE_FUZZY + nameFuzzy;
  const idFuzzy = fuzzyScore(id, q);
  if (idFuzzy !== null) return SCORE_FUZZY + idFuzzy;
  return SCORE_NO_MATCH;
}

function scoreDoc(d: Doc, q: string): number {
  if (q === "") return SCORE_NO_MATCH;
  const title = (d.title ?? "").toLowerCase();
  const name = (d.name ?? "").toLowerCase();
  const id = (d.id ?? "").toLowerCase();

  if (title === q || name === q) return SCORE_EXACT_NAME;
  if (id === q) return SCORE_EXACT_ID;
  if (title.startsWith(q)) return SCORE_NAME_PREFIX;
  if (id.includes(q)) return SCORE_ID_SUBSTR;
  if (title.includes(q) || name.includes(q)) return SCORE_NAME_SUBSTR;

  const titleFuzzy = fuzzyScore(title, q);
  if (titleFuzzy !== null) return SCORE_FUZZY + titleFuzzy;
  // Content match is the weakest signal.
  if ((d.content ?? "").toLowerCase().includes(q)) return SCORE_FUZZY / 2;
  return SCORE_NO_MATCH;
}

/**
 * Reports whether q is a subsequence of s and, if so, a density bonus that
 * rewards tightly-packed matches over scattered ones. Returns null on no match.
 */
export function fuzzyScore(s: string, q: string): number | null {
  if (q === "") return null;
  const sr = [...s];
  const qr = [...q];
  let si = 0;
  let qi = 0;
  let first = -1;
  let last = -1;
  while (si < sr.length && qi < qr.length) {
    if (sr[si] === qr[qi]) {
      if (first < 0) first = si;
      last = si;
      qi++;
    }
    si++;
  }
  if (qi !== qr.length) return null;
  let span = last - first + 1;
  if (span <= 0) span = 1;
  // Higher bonus when the matched runes are densely packed.
  return Math.trunc((qr.length * 50) / span);
}

function cap<T>(items: T[], limit: number): T[] {
  if (limit > 0 && items.length > limit) return items.slice(0, limit);
  return items;
}
