// Retrieves raw manifest text over HTTP using the native fetch API.
//
// The Fetcher type is intentionally minimal so callers can inject fakes in tests
// without touching the network.

/** Thrown when a fetch receives a non-2xx HTTP response. Drives exit code 3. */
export class HttpStatusError extends Error {
  readonly url: string;
  readonly status: number;
  constructor(url: string, status: number) {
    super(`fetch ${url}: unexpected status ${status}`);
    this.name = "HttpStatusError";
    this.url = url;
    this.status = status;
  }
}

/** Retrieves the raw text located at a URL. */
export type Fetcher = (url: string, signal?: AbortSignal) => Promise<string>;

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 64 << 20; // 64 MiB

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

/** Builds the default fetch-backed Fetcher. */
export function createFetcher(opts: FetchOptions = {}): Fetcher {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  return async (url: string, signal?: AbortSignal): Promise<string> => {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort(signal?.reason);
    if (signal) {
      if (signal.aborted) ctrl.abort(signal.reason);
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    const timer = setTimeout(() => ctrl.abort(new Error("request timed out")), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": "storyquery" },
        signal: ctrl.signal,
      });

      if (resp.status < 200 || resp.status >= 300) {
        throw new HttpStatusError(url, resp.status);
      }
      return await readCapped(resp, url, maxBytes);
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    }
  };
}

/** Reads a response body as text, aborting if it exceeds maxBytes. */
async function readCapped(resp: Response, url: string, maxBytes: number): Promise<string> {
  if (!resp.body) return await resp.text();

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          throw new Error(`read body from ${url}: response exceeds ${maxBytes} bytes`);
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks).toString("utf8");
}
