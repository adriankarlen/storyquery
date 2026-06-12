# storyquery

A CLI that queries Storybook design system manifests and answers questions about components and documentation. Built for agents (JSON-first output), but handy for humans too.

`storyquery` reads two manifest files published by Storybook:

- `<base-url>/manifests/components.json` (components, props, stories, imports)
- `<base-url>/manifests/docs.json` (MDX guideline pages)

Output defaults to JSON. Use `--format text` for human-readable output.

## Install

Requires Node.js >= 22.

### Run without installing

```sh
npx storyquery query MainButton --url https://your-storybook.example.com
```

### Global install

```sh
npm install -g storyquery
storyquery --version
```

If you want something shorter, add a shell alias: `alias sq='storyquery'`.

### As a project dependency

```sh
npm install --save-dev storyquery
```

Then run it via `npx storyquery ...` or a `package.json` script. Put the base URL
in `./.storyquery.json` so everyone on the project shares it.

## Configuration

The Storybook base URL is resolved in this order (highest precedence first):

1. `--url` flag
2. `SQ_URL` environment variable
3. `./.storyquery.json` (project-local)
4. `<user-config-dir>/storyquery/config.json` (global)

Config file format:

```json
{
  "url": "https://your-storybook.example.com",
  "cacheTTL": "1h"
}
```

`cacheTTL` accepts Go-style durations (`ms`, `s`, `m`, `h`), e.g. `"30m"`, `"1h30m"`.

Manifests are cached on disk under the OS cache directory. Default TTL is 1 hour.
Use `--refresh` to force a refetch or `--no-cache` to bypass the cache.

## Usage

```sh
# Search components and docs for a term (JSON by default)
storyquery query MainButton

# Full detail for one component (props, stories, guideline doc)
storyquery show MainButton

# List all components
storyquery list
storyquery list --filter button

# Search guideline / docs pages
storyquery docs "getting started"

# Human-readable output
storyquery query MainButton --format text

# Point at a specific Storybook instance
storyquery query Alert --url https://your-storybook.example.com
```

### Global flags

| Flag         | Description                                    |
| ------------ | ---------------------------------------------- |
| `--url`      | Storybook base URL (overrides env and config)  |
| `--format`   | `json` (default) or `text`                     |
| `--refresh`  | Force a fresh fetch, ignoring cached manifests |
| `--no-cache` | Bypass the cache entirely                      |

### Command flags

| Command | Flag       | Description                           |
| ------- | ---------- | ------------------------------------- |
| `query` | `--limit`  | max results per category (0 = all)    |
| `docs`  | `--limit`  | max results (0 = all)                 |
| `list`  | `--filter` | case-insensitive substring on name/id |

### Exit codes

| Code | Meaning             |
| ---- | ------------------- |
| 0    | success             |
| 1    | no match / error    |
| 2    | usage (e.g. no URL) |
| 3    | network/HTTP error  |

## Development

```sh
npm install
npm run build       # bundle to dist/ with tsup
npm run dev         # watch build
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run test:watch  # vitest
```

The CLI is authored in TypeScript and bundled to a single ESM file in `dist/`.
Runtime dependencies: [`citty`](https://github.com/unjs/citty) (command tree) and
[`arktype`](https://arktype.io) (lenient manifest validation). HTTP uses the
native `fetch` API.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, conventions, and the PR
workflow.

## License

[MIT](./LICENSE) © Adrian Karlen
