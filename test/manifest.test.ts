import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { guidelineFor } from "../src/manifest/guideline.js";
import { loadBundle } from "../src/manifest/service.js";
import {
  componentsVersionMismatch,
  parseComponents,
  parseDocs,
} from "../src/manifest/types.js";

const root = join(import.meta.dirname, "..", "testdata");
const componentsJson = readFileSync(join(root, "components.json"), "utf8");
const docsJson = readFileSync(join(root, "docs.json"), "utf8");

describe("parseComponents / parseDocs", () => {
  it("parses fixtures", () => {
    const c = parseComponents(componentsJson);
    expect(Object.keys(c.components ?? {}).length).toBeGreaterThan(0);
    const d = parseDocs(docsJson);
    expect(Object.keys(d.docs ?? {}).length).toBeGreaterThan(0);
  });

  it("is lenient: unknown keys pass", () => {
    const out = parseComponents(
      JSON.stringify({ v: 0, components: {}, unknownTopLevel: 42 }),
    );
    expect(out.components).toEqual({});
  });

  it("defaults missing maps to empty objects", () => {
    expect(parseComponents("{}").components).toEqual({});
    expect(parseDocs("{}").docs).toEqual({});
  });

  it("detects version mismatch", () => {
    expect(componentsVersionMismatch(parseComponents('{"v":0}'))).toBe(false);
    expect(componentsVersionMismatch(parseComponents('{"v":9}'))).toBe(true);
  });

  it("throws on invalid json", () => {
    expect(() => parseComponents("not json")).toThrow();
  });
});

describe("guidelineFor", () => {
  it("finds the alert guideline doc", () => {
    const docs = parseDocs(docsJson);
    const g = guidelineFor(docs, { id: "components-alert", name: "Alert" });
    expect(g?.id).toBe("components-alert-guidelines-usage--docs");
  });
  it("returns undefined when none exists", () => {
    const docs = parseDocs(docsJson);
    expect(guidelineFor(docs, { id: "components-nope", name: "Nope" })).toBeUndefined();
  });
});

describe("loadBundle", () => {
  it("loads both manifests via an injected fetcher", async () => {
    const bundle = await loadBundle({
      fetcher: async (url) => (url.includes("components") ? componentsJson : docsJson),
      componentsUrl: "https://x/manifests/components.json",
      docsUrl: "https://x/manifests/docs.json",
      ttlMs: 1000,
    });
    expect(Object.keys(bundle.components.components ?? {}).length).toBeGreaterThan(0);
    expect(bundle.warnings).toEqual([]);
  });

  it("emits a version-mismatch warning", async () => {
    const bundle = await loadBundle({
      fetcher: async (url) =>
        url.includes("components") ? '{"v":3,"components":{}}' : '{"v":0,"docs":{}}',
      componentsUrl: "https://x/manifests/components.json",
      docsUrl: "https://x/manifests/docs.json",
      ttlMs: 1000,
    });
    expect(bundle.warnings.some((w) => w.includes("components manifest schema v3"))).toBe(true);
  });
});
