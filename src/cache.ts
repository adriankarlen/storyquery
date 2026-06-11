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

/** A filesystem-backed Store rooted at a directory. */
export class Cache implements Store {
  private readonly dir: string;
  private readonly now: () => number;
  private ready: Promise<void> | null = null;

  constructor(dir: string, opts: CacheOptions = {}) {
    this.dir = dir;
    this.now = opts.now ?? Date.now;
  }

  private ensureDir(): Promise<void> {
    if (!this.ready) this.ready = mkdir(this.dir, { recursive: true }).then(() => undefined);
    return this.ready;
  }

  private dataPath(key: string): string {
    return join(this.dir, `${key}.data`);
  }

  private metaPath(key: string): string {
    return join(this.dir, `${key}.meta.json`);
  }

  async load(key: string, ttlMs: number): Promise<CacheEntry> {
    let data: string;
    try {
      data = await readFile(this.dataPath(key), "utf8");
    } catch (err) {
      if (isNotFound(err)) return { fresh: false, ok: false };
      throw new Error(`read cache data: ${errMsg(err)}`);
    }

    let fresh = false;
    try {
      const raw = await readFile(this.metaPath(key), "utf8");
      const meta = JSON.parse(raw) as Meta;
      const fetchedAt = Date.parse(meta.fetched_at);
      if (!Number.isNaN(fetchedAt)) fresh = this.now() - fetchedAt < ttlMs;
    } catch {
      // Missing or unreadable meta: treat as stale.
    }

    return { data, fresh, ok: true };
  }

  async save(key: string, data: string): Promise<void> {
    await this.ensureDir();
    try {
      await writeFile(this.dataPath(key), data, "utf8");
    } catch (err) {
      throw new Error(`write cache data: ${errMsg(err)}`);
    }
    const meta: Meta = { fetched_at: new Date(this.now()).toISOString() };
    try {
      await writeFile(this.metaPath(key), JSON.stringify(meta), "utf8");
    } catch (err) {
      throw new Error(`write cache meta: ${errMsg(err)}`);
    }
  }
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
