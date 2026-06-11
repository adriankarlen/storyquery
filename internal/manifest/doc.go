// Package manifest models the Storybook design-system manifest files served at
// <base>/manifests/components.json and <base>/manifests/docs.json, and provides
// a Service for fetching, caching, and querying them.
//
// The manifests describe a design system: each component carries its TypeScript
// prop documentation (via react-docgen-typescript), example stories with code
// snippets, an import statement, and a free-text description. The docs manifest
// carries MDX guideline pages (usage guidelines, tokens, getting started, etc.).
//
// The schema is versioned through the top-level "v" field. Parsing is
// intentionally lenient: unknown fields are ignored so the CLI keeps working as
// the upstream schema evolves.
package manifest
