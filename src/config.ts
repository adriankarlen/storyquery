// Resolves the storyquery runtime configuration from, in order of precedence:
// command-line flag, environment variable, a project-local file
// (./.storyquery.json), and a global file (<userConfigDir>/storyquery/config.json).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** The environment variable holding the Storybook base URL. */
export const ENV_URL = "SQ_URL";

/** The project-local config filename. */
export const PROJECT_FILE = ".storyquery.json";

/** The cache time-to-live used when none is configured (1 hour, in ms). */
export const DEFAULT_TTL_MS = 60 * 60 * 1000;

/** Thrown when no base URL could be resolved from any source. Drives exit code 2. */
export class NoUrlError extends Error {
  constructor() {
    super("no storybook url configured: pass --url, set SQ_URL, or add a config file");
    this.name = "NoUrlError";
  }
}

/** The resolved runtime configuration. */
export interface Config {
  baseUrl: string;
  cacheTtlMs: number;
}

interface FileConfig {
  url?: string;
  cacheTTL?: string;
}

/**
 * Produces a Config from the flag value (may be empty), the environment, and
 * config files. flagUrl takes highest precedence.
 */
export function resolveConfig(flagUrl?: string): Config {
  let baseUrl = "";
  let cacheTtlMs = DEFAULT_TTL_MS;

  const apply = (f: FileConfig) => {
    const u = f.url?.trim();
    if (u) baseUrl = u;
    const ttl = f.cacheTTL?.trim();
    if (ttl) {
      const ms = parseDuration(ttl);
      if (ms !== null) cacheTtlMs = ms;
    }
  };

  // Lowest precedence first; later assignments win.
  const global = loadFile(globalPath());
  if (global) apply(global);
  const project = loadFile(PROJECT_FILE);
  if (project) apply(project);

  const env = process.env[ENV_URL]?.trim();
  if (env) baseUrl = env;

  const flag = flagUrl?.trim();
  if (flag) baseUrl = flag;

  baseUrl = baseUrl.replace(/\/+$/, "");
  if (!baseUrl) throw new NoUrlError();

  return { baseUrl, cacheTtlMs };
}

/** The absolute URL of the components manifest. */
export function componentsUrl(cfg: Config): string {
  return `${cfg.baseUrl}/manifests/components.json`;
}

/** The absolute URL of the docs manifest. */
export function docsUrl(cfg: Config): string {
  return `${cfg.baseUrl}/manifests/docs.json`;
}

/** The directory used for the manifest cache. */
export function cacheDir(): string {
  return join(userCacheDir(), "storyquery");
}

function loadFile(path: string): FileConfig | null {
  if (!path) return null;
  try {
    const data = readFileSync(path, "utf8");
    return JSON.parse(data) as FileConfig;
  } catch {
    return null;
  }
}

function globalPath(): string {
  return join(userConfigDir(), "storyquery", "config.json");
}

/**
 * Parses a Go time.Duration-style string (a subset: s/m/h, optionally combined,
 * e.g. "1h", "30m", "1h30m", "90s") into milliseconds. Returns null on error.
 */
export function parseDuration(s: string): number | null {
  const re = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
  let ms = 0;
  let matched = false;
  let lastIndex = 0;
  for (let m = re.exec(s); m !== null; m = re.exec(s)) {
    if (m.index !== lastIndex) return null; // gap = junk between units
    matched = true;
    const value = Number(m[1]);
    switch (m[2]) {
      case "ms":
        ms += value;
        break;
      case "s":
        ms += value * 1000;
        break;
      case "m":
        ms += value * 60_000;
        break;
      case "h":
        ms += value * 3_600_000;
        break;
    }
    lastIndex = re.lastIndex;
  }
  if (!matched || lastIndex !== s.length) return null;
  return ms;
}

// --- Platform directories (no dependency) ---

function userConfigDir(): string {
  const home = homedir();
  switch (process.platform) {
    case "win32":
      return process.env.APPDATA ?? join(home, "AppData", "Roaming");
    case "darwin":
      return join(home, "Library", "Application Support");
    default:
      return process.env.XDG_CONFIG_HOME ?? join(home, ".config");
  }
}

function userCacheDir(): string {
  const home = homedir();
  switch (process.platform) {
    case "win32":
      return process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
    case "darwin":
      return join(home, "Library", "Caches");
    default:
      return process.env.XDG_CACHE_HOME ?? join(home, ".cache");
  }
}
