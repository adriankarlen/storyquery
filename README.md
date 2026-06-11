# storyquery

A CLI that queries Storybook design system manifests and answers questions about components and documentation.

`storyquery` reads two manifest files published by Storybook:

- `<base-url>/manifests/components.json` (components, props, stories, imports)
- `<base-url>/manifests/docs.json` (MDX guideline pages)

Output defaults to JSON. Use `--format text` for human-readable output.

## Install

```sh
go install github.com/adriankarlen/storyquery/cmd/storyquery@latest
```

Or build from source:

```sh
make build      # bin/storyquery
make build-all  # cross-compile for linux/darwin/windows (amd64 + arm64)
```

The binary is `storyquery`. If you want something shorter, add a shell alias: `alias sq='storyquery'`.

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

Manifests are cached on disk under the OS cache directory. Default TTL is 1 hour. Use `--refresh` to force a refetch or `--no-cache` to bypass the cache.

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
