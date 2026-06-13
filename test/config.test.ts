import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PROJECT_FILE,
  componentsUrl,
  docsUrl,
  parseDuration,
  resolveConfig,
} from "../src/config.js";

describe("parseDuration", () => {
  it("parses single units", () => {
    expect(parseDuration("1h")).toBe(3_600_000);
    expect(parseDuration("30m")).toBe(1_800_000);
    expect(parseDuration("90s")).toBe(90_000);
    expect(parseDuration("250ms")).toBe(250);
  });
  it("parses combined units", () => {
    expect(parseDuration("1h30m")).toBe(5_400_000);
  });
  it("rejects junk", () => {
    expect(parseDuration("nonsense")).toBeNull();
    expect(parseDuration("1x")).toBeNull();
    expect(parseDuration("1h junk")).toBeNull();
  });
});

describe("resolveConfig precedence", () => {
  it("flag wins over env", () => {
    process.env.SQ_URL = "https://from-env.example.com";
    const cfg = resolveConfig("https://from-flag.example.com/");
    expect(cfg.baseUrl).toBe("https://from-flag.example.com");
    delete process.env.SQ_URL;
  });

  it("env used when no flag", () => {
    process.env.SQ_URL = "https://from-env.example.com/";
    const cfg = resolveConfig();
    expect(cfg.baseUrl).toBe("https://from-env.example.com");
    delete process.env.SQ_URL;
  });

  it("throws NoUrlError when nothing configured", () => {
    delete process.env.SQ_URL;
    // Run from a dir without a project config file.
    const cwd = process.cwd();
    process.chdir("/tmp");
    try {
      expect(() => resolveConfig()).toThrow(/no storybook url/i);
    } finally {
      process.chdir(cwd);
    }
  });

  it("builds manifest URLs", () => {
    const cfg = resolveConfig("https://x.example.com");
    expect(componentsUrl(cfg)).toBe("https://x.example.com/manifests/components.json");
    expect(docsUrl(cfg)).toBe("https://x.example.com/manifests/docs.json");
  });
});

describe("resolveConfig warnings", () => {
  it("warns on a malformed project config file but still resolves", () => {
    const dir = mkdtempSync(join(tmpdir(), "sq-config-"));
    const cwd = process.cwd();
    process.chdir(dir);
    delete process.env.SQ_URL;
    try {
      writeFileSync(join(dir, PROJECT_FILE), "{ not valid json", "utf8");
      const cfg = resolveConfig("https://x.example.com");
      expect(cfg.baseUrl).toBe("https://x.example.com");
      expect(cfg.warnings.some((w) => /malformed config file/.test(w))).toBe(true);
    } finally {
      process.chdir(cwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("has no warnings for a clean resolution", () => {
    const cwd = process.cwd();
    process.chdir(tmpdir());
    delete process.env.SQ_URL;
    try {
      const cfg = resolveConfig("https://x.example.com");
      expect(cfg.warnings).toEqual([]);
    } finally {
      process.chdir(cwd);
    }
  });
});
