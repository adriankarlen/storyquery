import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { cacheKey, createCache } from "../src/cache.js";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "sq-cache-"));
}

describe("createCache", () => {
  it("returns ok=false for a missing entry", async () => {
    const c = createCache(tmp());
    const entry = await c.load(cacheKey("missing"), 1000);
    expect(entry.ok).toBe(false);
    expect(entry.fresh).toBe(false);
  });

  it("saves then loads fresh within ttl", async () => {
    let now = 1_000_000;
    const c = createCache(tmp(), { now: () => now });
    const key = cacheKey("https://x/components.json");
    await c.save(key, "payload");
    now += 500;
    const entry = await c.load(key, 1000);
    expect(entry.ok).toBe(true);
    expect(entry.fresh).toBe(true);
    expect(entry.data).toBe("payload");
  });

  it("reports stale once ttl elapsed", async () => {
    let now = 1_000_000;
    const c = createCache(tmp(), { now: () => now });
    const key = cacheKey("k");
    await c.save(key, "data");
    now += 2000;
    const entry = await c.load(key, 1000);
    expect(entry.ok).toBe(true);
    expect(entry.fresh).toBe(false);
  });
});

describe("cacheKey", () => {
  it("is stable and 32 hex chars", () => {
    const a = cacheKey("https://x");
    const b = cacheKey("https://x");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
  it("differs for different inputs", () => {
    expect(cacheKey("a")).not.toBe(cacheKey("b"));
  });
});
