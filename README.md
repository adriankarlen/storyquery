# storyquery

A small, cross-platform CLI that queries a Storybook design system's manifest
files and answers questions about its components and documentation. It is built
to help engineers — and coding agents — discover how to use an internal design
system without leaving the terminal.

`storyquery` reads two manifest files published by a Storybook instance:

- `<base-url>/manifests/components.json` — components, props, stories, imports
- `<base-url>/manifests/docs.json` — MDX guideline/documentation pages

Output is JSON by default (agent-friendly) and can be switched to human-readable
text with `--format text`.

## Install

```sh
go install github.com/adriankarlen/storyquery/cmd/storyquery@latest
```

Or build from source:

```sh
make build      # -> bin/storyquery
make build-all  # cross-compile linux/darwin/windows (amd64 + arm64)
```

The binary is named `storyquery`. If you want a shorter command, add your own
shell alias (e.g. `alias sq='storyquery'`).

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

Manifests are cached on disk under the OS cache directory with a default TTL of
1 hour. Use `--refresh` to force a refetch or `--no-cache` to bypass the cache.

## Usage

```sh
# Search components and docs for a term (default JSON output)
storyquery query MainButton

# Full detail for a single component (props, stories, guideline doc)
storyquery show MainButton

# List every component
storyquery list
storyquery list --filter button

# Search guideline / documentation pages
storyquery docs "getting started"

# Human-readable output
storyquery query MainButton --format text

# Point at a specific instance
storyquery query Alert --url https://your-storybook.example.com
```

### Global flags

| Flag         | Description                                       |
|--------------|---------------------------------------------------|
| `--url`      | Storybook base URL (overrides env and config)     |
| `--format`   | `json` (default) or `text`                        |
| `--refresh`  | Force a fresh fetch, ignoring cached manifests     |
| `--no-cache` | Bypass the cache entirely                          |

### Exit codes

| Code | Meaning              |
|------|----------------------|
| 0    | success              |
| 1    | no match / error     |
| 2    | usage (e.g. no URL)  |
| 3    | network/HTTP error   |

## Development

```sh
make test           # go test -race ./...
make test-coverage  # coverage report
make fuzz           # fuzz the search scorer
make vet            # go vet
make lint           # golangci-lint
make fmt            # gofmt
```
