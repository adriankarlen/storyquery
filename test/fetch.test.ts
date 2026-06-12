import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpStatusError, createFetcher } from "../src/fetch.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("createFetcher", () => {
  it("returns body text on 2xx", async () => {
    globalThis.fetch = vi.fn(async () => new Response("hello", { status: 200 })) as never;
    const fetcher = createFetcher();
    await expect(fetcher("https://x")).resolves.toBe("hello");
  });

  it("throws HttpStatusError on non-2xx", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 404 })) as never;
    const fetcher = createFetcher();
    await expect(fetcher("https://x")).rejects.toBeInstanceOf(HttpStatusError);
  });

  it("enforces a byte cap", async () => {
    const big = "x".repeat(1000);
    globalThis.fetch = vi.fn(async () => new Response(big, { status: 200 })) as never;
    const fetcher = createFetcher({ maxBytes: 10 });
    await expect(fetcher("https://x")).rejects.toThrow(/exceeds/);
  });

  it("sets storyquery headers", async () => {
    const spy = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response("{}", { status: 200 }),
    );
    globalThis.fetch = spy as never;
    await createFetcher()("https://x");
    const init = spy.mock.calls[0]?.[1];
    const headers = init?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("storyquery");
    expect(headers.Accept).toBe("application/json");
  });
});
