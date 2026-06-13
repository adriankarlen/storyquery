// Build-time injected version. tsdown replaces __STORYQUERY_VERSION__ via `define`;
// vitest does the same. Falls back to "dev" if somehow not replaced.
declare const __STORYQUERY_VERSION__: string;

export const VERSION: string =
  typeof __STORYQUERY_VERSION__ === "string" ? __STORYQUERY_VERSION__ : "dev";
