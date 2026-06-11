import { describe, expect, it } from "vitest";
import type { Component, Doc } from "../src/manifest/types.js";
import {
  type Renderable,
  detailComponent,
  encode,
  parseFormat,
  summarizeComponent,
} from "../src/output/index.js";

const button: Component = {
  id: "components-button",
  name: "Button",
  description: "A button",
  import: 'import { Button } from "@acme/ds";',
  path: "./Button.tsx",
  stories: [{ id: "s1", name: "Primary", snippet: "<Button/>" }],
  reactDocgenTypescript: {
    filePath: "./Button.tsx",
    props: {
      variant: {
        name: "variant",
        required: false,
        defaultValue: { value: '"primary"' },
        type: { name: "enum", raw: '"primary" | "secondary"' },
      },
      children: {
        name: "children",
        required: true,
        type: { name: "ReactNode" },
      },
    },
  },
};

describe("parseFormat", () => {
  it("accepts json and text", () => {
    expect(parseFormat("json")).toBe("json");
    expect(parseFormat("TEXT")).toBe("text");
  });
  it("rejects others", () => {
    expect(() => parseFormat("yaml")).toThrow();
  });
});

describe("summarizeComponent", () => {
  it("omits empty/zero optional fields and counts props/stories", () => {
    const s = summarizeComponent(button, 0);
    expect(s).toEqual({
      id: "components-button",
      name: "Button",
      description: "A button",
      import: 'import { Button } from "@acme/ds";',
      props: 2,
      stories: 1,
    });
    expect("score" in s).toBe(false);
  });
  it("includes score when non-zero", () => {
    expect(summarizeComponent(button, 700).score).toBe(700);
  });
});

describe("detailComponent", () => {
  it("sorts props by name and renders type/default", () => {
    const d = detailComponent(button);
    expect(d.props.map((p) => p.name)).toEqual(["children", "variant"]);
    const variant = d.props.find((p) => p.name === "variant")!;
    expect(variant.type).toBe('"primary" | "secondary"');
    expect(variant.default).toBe('"primary"');
    expect(variant.required).toBe(false);
  });
  it("attaches a guideline when provided", () => {
    const g: Doc = { id: "g1", title: "Usage", content: "do this" };
    const d = detailComponent(button, g);
    expect(d.guideline?.id).toBe("g1");
  });
});

describe("encode", () => {
  const payload: Renderable = {
    kind: "detail",
    value: detailComponent(button),
  };
  it("produces valid JSON", () => {
    const out = encode("json", payload);
    expect(JSON.parse(out).name).toBe("Button");
  });
  it("produces human text", () => {
    const out = encode("text", payload);
    expect(out).toContain("Button (components-button)");
    expect(out).toContain("Props (2):");
  });
});
