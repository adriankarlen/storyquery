// Shared global arguments and the bundle-loading helper used by every command.
import { createCache } from "../cache.js";
import { type Config, cacheDir, componentsUrl, docsUrl, resolveConfig } from "../config.js";
import { createFetcher } from "../fetch.js";
import type { Bundle } from "../manifest/service.js";
import { loadBundle as loadManifestBundle } from "../manifest/service.js";
import { type Format, parseFormat } from "../output/index.js";

/** Global args shared by all subcommands (citty has no inherited flags). */
export const globalArgs = {
  url: {
    type: "string",
    description: "Storybook base URL (overrides SQ_URL and config files)",
  },
  format: {
    type: "string",
    description: "output format: json or text",
    default: "json",
  },
  refresh: {
    type: "boolean",
    description: "force a fresh fetch, ignoring cached manifests",
    default: false,
  },
  cache: {
    type: "boolean",
    description: "use the on-disk cache (use --no-cache to bypass)",
    default: true,
  },
} as const;

export interface GlobalOpts {
  url?: string;
  format: string;
  refresh: boolean;
  cache: boolean;
}

/** Resolves the --format flag. */
export function resolveFormat(args: GlobalOpts): Format {
  return parseFormat(args.format);
}

const LOAD_TIMEOUT_MS = 45_000;

/**
 * Resolves config, builds the manifest service, and loads both manifests.
 * Shared by every subcommand. Bounds the overall load so a hung server cannot
 * block forever.
 */
export async function loadBundle(args: GlobalOpts): Promise<Bundle> {
  const cfg: Config = resolveConfig(args.url);
  const fetcher = createFetcher();

  const store = args.cache ? createCache(cacheDir()) : undefined;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("manifest load timed out")), LOAD_TIMEOUT_MS);
  try {
    return await loadManifestBundle(
      {
        fetcher,
        componentsUrl: componentsUrl(cfg),
        docsUrl: docsUrl(cfg),
        ttlMs: cfg.cacheTtlMs,
        refresh: args.refresh,
        store,
      },
      ctrl.signal,
    );
  } finally {
    clearTimeout(timer);
  }
}
