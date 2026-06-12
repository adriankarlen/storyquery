import { describe, expect, it } from "vitest";

import type { Component, Doc } from "../src/manifest/types.js";
import { bestComponent, fuzzyScore, searchComponents, searchDocs } from "../src/search.js";

function comp(id: string, name: string): Component {
  return { id, name };
}

const comps: Record<string, Component> = {
  a: comp("components-button", "Button"),
  b: comp("components-iconbutton", "IconButton"),
  c: comp("components-alert", "Alert"),
};

describe("searchComponents", () => {
  it("ranks exact name highest", () => {
    const res = searchComponents(comps, "Button", 0);
    expect(res[0]?.component.name).toBe("Button");
    expect(res[0]?.score).toBe(1000);
  });

  it("exact id beats prefix", () => {
    const res = searchComponents(comps, "components-alert", 0);
    expect(res[0]?.component.id).toBe("components-alert");
    expect(res[0]?.score).toBe(900);
  });

  it("name prefix outranks substring", () => {
    const res = searchComponents(comps, "but", 0);
    // "Button" starts with "but" -> prefix; IconButton only contains it.
    expect(res[0]?.component.name).toBe("Button");
  });

  it("respects limit", () => {
    expect(searchComponents(comps, "components", 1)).toHaveLength(1);
    expect(searchComponents(comps, "components", 0).length).toBeGreaterThan(1);
  });

  it("empty term matches nothing", () => {
    expect(searchComponents(comps, "", 0)).toHaveLength(0);
  });
});

describe("bestComponent", () => {
  it("returns found for a unique exact match", () => {
    const r = bestComponent(comps, "Button");
    expect(r.kind).toBe("found");
  });

  it("returns ambiguous when top scores tie", () => {
    const r = bestComponent(comps, "components");
    expect(r.kind).toBe("ambiguous");
  });

  it("returns none for no match", () => {
    expect(bestComponent(comps, "zzzz").kind).toBe("none");
  });
});

describe("searchDocs", () => {
  const docs: Record<string, Doc> = {
    a: { id: "intro--docs", title: "Introduction", content: "welcome here" },
    b: { id: "tokens--docs", title: "Design Tokens", content: "colors" },
  };
  it("matches on title", () => {
    const res = searchDocs(docs, "introduction", 0);
    expect(res[0]?.doc.title).toBe("Introduction");
  });
  it("matches weakly on content", () => {
    const res = searchDocs(docs, "colors", 0);
    expect(res[0]?.doc.id).toBe("tokens--docs");
    expect(res[0]?.score).toBe(50);
  });
});

describe("fuzzyScore", () => {
  it("matches a subsequence", () => {
    expect(fuzzyScore("button", "btn")).not.toBeNull();
  });
  it("rejects a non-subsequence", () => {
    expect(fuzzyScore("button", "xyz")).toBeNull();
  });
  it("rewards density", () => {
    const dense = fuzzyScore("button", "but")!;
    const sparse = fuzzyScore("b-u-t-x", "but")!;
    expect(dense).toBeGreaterThan(sparse);
  });

  // Fuzz-style: random inputs must never throw and scores stay non-negative.
  it("never throws and scores >= 0 for random input", () => {
    const chars = "abcdefg-0 ";
    const rand = (n: number) =>
      Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    for (let i = 0; i < 2000; i++) {
      const s = rand(Math.floor(Math.random() * 12));
      const q = rand(Math.floor(Math.random() * 5));
      const r = fuzzyScore(s, q);
      if (r !== null) expect(r).toBeGreaterThanOrEqual(0);
    }
  });
});
