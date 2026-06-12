// A small TTL-based disk cache for manifest text.
//
// Entries are keyed by an opaque string (typically derived from the source URL).
// Each entry stores the raw payload plus a sidecar metadata file holding the
// fetch timestamp, enabling both TTL checks and stale-fallback reads.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface CacheEntry {
  /** The cached payload, or undefined when the entry is missing (ok=false). */
  data?: string;
  /** Whether the entry is within the TTL window. */
  fresh: boolean;
  /** Whether an entry exists at all. */
  ok: boolean;
}

/** Loads and saves cached payloads. */
export interface Store {
  load(key: string, ttlMs: number): Promise<CacheEntry>;
  save(key: string, data: string): Promise<void>;
}

interface Meta {
  fetched_at: string;
}

export interface CacheOptions {
  /** Overrides the time source (used in tests). */
  now?: () => number;
}

/** Builds a filesystem-backed Store rooted at a directory. */
export function createCache(dir: string, opts: CacheOptions = {}): Store {
  const now = opts.now ?? Date.now;
  let ready: Promise<void> | null = null;

  const ensureDir = (): Promise<void> => {
    if (!ready) ready = mkdir(dir, { recursive: true }).then(() => undefined);
    return ready;
  };

  const dataPath = (key: string): string => join(dir, `${key}.data`);
  const metaPath = (key: string): string => join(dir, `${key}.meta.json`);

  return {
    async load(key: string, ttlMs: number): Promise<CacheEntry> {
      let data: string;
      try {
        data = await readFile(dataPath(key), "utf8");
      } catch (err) {
        if (isNotFound(err)) return { fresh: false, ok: false };
        throw new Error(`read cache data: ${errMsg(err)}`);
      }

      let fresh = false;
      try {
        const raw = await readFile(metaPath(key), "utf8");
        const meta = JSON.parse(raw) as Meta;
        const fetchedAt = Date.parse(meta.fetched_at);
        if (!Number.isNaN(fetchedAt)) fresh = now() - fetchedAt < ttlMs;
      } catch {
        // Missing or unreadable meta: treat as stale.
      }

      return { data, fresh, ok: true };
    },

    async save(key: string, data: string): Promise<void> {
      await ensureDir();
      try {
        await writeFile(dataPath(key), data, "utf8");
      } catch (err) {
        throw new Error(`write cache data: ${errMsg(err)}`);
      }
      const meta: Meta = { fetched_at: new Date(now()).toISOString() };
      try {
        await writeFile(metaPath(key), JSON.stringify(meta), "utf8");
      } catch (err) {
        throw new Error(`write cache meta: ${errMsg(err)}`);
      }
    },
  };
}

/** Derives a stable, filesystem-safe cache key from arbitrary parts. */
export function cacheKey(...parts: string[]): string {
  const h = createHash("sha256");
  for (const p of parts) {
    h.update(p);
    h.update(Buffer.from([0]));
  }
  return h.digest("hex").slice(0, 32);
}

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === "ENOENT";
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
