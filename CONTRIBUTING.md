# Contributing to storyquery

Thanks for your interest in contributing. This document describes how to set up
the project, the conventions we follow, and how to get a change merged.

## Prerequisites

- Node.js >= 20 (CI tests against 22, 24, and 26)
- [pnpm](https://pnpm.io) 11.6.0 (declared in `packageManager`; use
  [Corepack](https://nodejs.org/api/corepack.html) to match it: `corepack enable`)

## Getting started

```sh
git clone https://github.com/adriankarlen/storyquery.git
cd storyquery
pnpm install --frozen-lockfile
```

## Development workflow

```sh
pnpm dev          # watch build to dist/
pnpm build        # bundle to dist/ with tsdown
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest run
pnpm test:watch   # vitest in watch mode
pnpm lint         # oxlint
pnpm lint:fix     # oxlint --fix
pnpm format       # oxfmt (write)
pnpm format:check # oxfmt (verify)
```

Before opening a pull request, make sure the full check suite passes locally —
this mirrors CI:

```sh
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Project layout

```
src/
  cli.ts            Entry point; wires the command tree and maps errors to exit codes.
  config.ts         Config resolution (flag > env > project file > global file).
  fetch.ts          HTTP fetcher factory (native fetch, timeout + byte cap).
  cache.ts          Disk TTL cache factory (createCache).
  search.ts         Ranking / fuzzy search engine.
  commands/         One module per subcommand (query, show, list, docs) + shared helpers.
  manifest/         Manifest fetch/parse service and arktype schemas.
  output/           View models and JSON/text renderers.
test/               Vitest specs mirroring src/.
```

### Conventions

- **Functional first.** Prefer plain functions, factory functions, interfaces,
  and dependency injection via function/interface types over classes. The only
  classes in the codebase are custom `Error` subclasses (needed for `instanceof`
  exit-code mapping).
- **JSON-first output.** New command output should default to JSON; add a text
  renderer in `src/output/` for human-readable mode.
- **arktype is the source of truth** for manifest shapes in `src/manifest/types.ts`.
- Keep runtime dependencies minimal.
- Add or update tests for any behavioral change.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/). The commit
type prefixes the subject line:

```
<type>: <short summary>

<optional body explaining what and why>
```

Common types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`, `build`.

Examples:

```
feat: add --json-pretty flag to query command
fix: handle empty manifest without throwing
refactor: convert Cache class to createCache factory
```

## Pull requests

The `main` branch is protected — all changes land through a pull request.

1. Fork or branch off `main`.
2. Make your change with accompanying tests.
3. Run the full check suite (see above).
4. Open a PR with a clear description of what changed and why.
5. Ensure CI is green.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE).
