// Shared global arguments and the bundle-loading helper used by every command.
import type { ArgsDef, CommandMeta, ParsedArgs } from "citty";
import { defineCommand } from "citty";

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
} as const satisfies ArgsDef;

/** The parsed global flags every command receives, derived from {@link globalArgs}. */
export type GlobalOpts = ParsedArgs<typeof globalArgs>;

/**
 * Defines a subcommand with the shared global args mixed in. The `run` callback
 * receives `args` fully typed as the command's own args plus {@link GlobalOpts},
 * removing the need for an `as unknown as GlobalOpts` cast in each command.
 */
export function defineGlobalCommand<const A extends ArgsDef>(spec: {
  meta: CommandMeta;
  args?: A;
  run: (ctx: { args: ParsedArgs<A & typeof globalArgs> }) => void | Promise<void>;
}) {
  return defineCommand({
    meta: spec.meta,
    args: { ...(spec.args ?? ({} as A)), ...globalArgs },
    run: ({ args }) => spec.run({ args: args as ParsedArgs<A & typeof globalArgs> }),
  });
}

/** Resolves the --format flag. */
export function resolveFormat(args: GlobalOpts): Format {
  return parseFormat(args.format);
}

/** Default maximum results per category for the query and docs commands. */
export const DEFAULT_QUERY_LIMIT = 10;

/** Parses a --limit flag string; non-numeric or non-positive values mean "all" (0). */
export function parseLimit(value: string): number {
  return Number.parseInt(value, 10) || 0;
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
