// Fetches, caches, and parses the manifest bundle.
import type { Store } from "../cache.js";
import { cacheKey } from "../cache.js";
import type { Fetcher } from "../fetch.js";
import {
  type Components,
  type Docs,
  SCHEMA_VERSION,
  componentsVersionMismatch,
  docsVersionMismatch,
  parseComponents,
  parseDocs,
} from "./types.js";

/** Returned when a query matches no component or doc. */
export class NotFoundError extends Error {
  constructor(message = "no match found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Returned when a lookup expecting a single result matches many. */
export class AmbiguousError extends Error {
  readonly candidates: string[];
  constructor(message: string, candidates: string[] = []) {
    super(message);
    this.name = "AmbiguousError";
    this.candidates = candidates;
  }
}

/** Both parsed manifests together with version warnings. */
export interface Bundle {
  components: Components;
  docs: Docs;
  /** Non-fatal messages (e.g. schema version mismatch, stale cache). */
  warnings: string[];
}

export interface ServiceOptions {
  fetcher: Fetcher;
  componentsUrl: string;
  docsUrl: string;
  ttlMs: number;
  refresh?: boolean;
  /** A cache store; omit to always fetch fresh. */
  store?: Store;
}

interface LoadedManifest {
  data: string;
  warnings: string[];
}

/** Fetches and parses both manifests, fetching them concurrently. */
export async function loadBundle(
  opts: ServiceOptions,
  signal?: AbortSignal,
): Promise<Bundle> {
  const [comp, docs] = await Promise.all([
    loadOne(opts, "components", opts.componentsUrl, signal),
    loadOne(opts, "docs", opts.docsUrl, signal),
  ]);

  const warnings = [...comp.warnings, ...docs.warnings];

  const components = parseComponents(comp.data);
  const parsedDocs = parseDocs(docs.data);

  if (componentsVersionMismatch(components)) {
    warnings.push(
      `components manifest schema v${components.v ?? 0} differs from supported v${SCHEMA_VERSION}`,
    );
  }
  if (docsVersionMismatch(parsedDocs)) {
    warnings.push(
      `docs manifest schema v${parsedDocs.v ?? 0} differs from supported v${SCHEMA_VERSION}`,
    );
  }

  return { components, docs: parsedDocs, warnings };
}

/**
 * Resolves a single manifest, using the cache when enabled and falling back to a
 * stale cache entry if the network fetch fails.
 */
async function loadOne(
  opts: ServiceOptions,
  label: string,
  url: string,
  signal?: AbortSignal,
): Promise<LoadedManifest> {
  if (!url) throw new Error(`${label} manifest url not configured`);

  const warnings: string[] = [];

  if (opts.store) {
    const key = cacheKey(url);
    const entry = await opts.store.load(key, opts.ttlMs);
    if (entry.ok && entry.fresh && !opts.refresh && entry.data !== undefined) {
      return { data: entry.data, warnings };
    }

    // Need to fetch; keep any stale copy for fallback.
    try {
      const fetched = await opts.fetcher(url, signal);
      try {
        await opts.store.save(key, fetched);
      } catch (err) {
        warnings.push(`failed to cache ${label} manifest: ${errMsg(err)}`);
      }
      return { data: fetched, warnings };
    } catch (err) {
      if (entry.ok && entry.data !== undefined) {
        warnings.push(`using stale cached ${label} manifest: ${errMsg(err)}`);
        return { data: entry.data, warnings };
      }
      throw new Error(`fetch ${label} manifest: ${errMsg(err)}`, { cause: err });
    }
  }

  try {
    const fetched = await opts.fetcher(url, signal);
    return { data: fetched, warnings };
  } catch (err) {
    throw new Error(`fetch ${label} manifest: ${errMsg(err)}`, { cause: err });
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
