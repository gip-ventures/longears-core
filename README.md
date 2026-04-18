# Longears

A GitHub Action that scans your project dependencies across multiple ecosystems and fetches their latest metadata from package registries. Longears collects the data — what version you have, what's available — without creating pull requests itself.

## Overview

Longears reads a `longears.yml` configuration file, determines which ecosystems are due to run based on their schedules, finds manifest files in your repository, and queries the appropriate registries for current package metadata. Results are written to a JSON file that downstream steps can use to open PRs, file issues, or trigger alerts.

## Supported Ecosystems

| Ecosystem | Manifest files |
|---|---|
| `npm` | `package.json` |
| `pip` | `requirements.txt`, `Pipfile`, `pyproject.toml` |
| `bundler` | `Gemfile`, `Gemfile.lock` |
| `docker` | `Dockerfile`, `docker-compose.yml` |
| `github-actions` | `.github/workflows/*.yml` |
| `gomod` | `go.mod` |
| `maven` | `pom.xml` |
| `nuget` | `*.csproj`, `*.fsproj`, `packages.config`, `Directory.Packages.props` |
| `composer` | `composer.json` |
| `gitsubmodule` | `.gitmodules` |
| `devcontainers` | `.devcontainer/**` |
| `dotnet-sdk` | `global.json` |
| `mix` | `mix.exs` |
| `pub` | `pubspec.yaml` |

## Usage

Add a workflow that runs Longears on a schedule:

```yaml
name: Dependency Scan

on:
  schedule:
    - cron: "0 * * * *"   # run hourly; per-ecosystem schedules control what actually executes
  workflow_dispatch:
    inputs:
      force:
        description: Run all ecosystems regardless of their configured schedule
        type: boolean
        default: false

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Run Longears
        uses: gip-ventures/longears-core@v1
        id: longears
        with:
          config-path: .github/longears.yml
          force: ${{ inputs.force || 'false' }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          output-file: longears-results.json

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: longears-results
          path: ${{ steps.longears.outputs.results-path }}
```

## Configuration

Create `.github/longears.yml` in your repository:

```yaml
version: 2

# Optional: define shared schedules that multiple ecosystems can reference
multi-ecosystem-groups:
  monthly-low-priority:
    schedule:
      interval: monthly
      time: "16:00"
      timezone: "UTC"

updates:
  - package-ecosystem: npm
    directory: /          # root of the repo; use directories: [/a, /b] for multiple
    schedule:
      interval: weekly
      day: sunday
      time: "16:00"
      timezone: "UTC"
    groups:
      all-dependencies:
        patterns: ["*"]
    ignore:
      - dependency-name: lodash
        update-types: [major]

  - package-ecosystem: docker
    directory: /
    multi-ecosystem-group: monthly-low-priority   # inherits schedule from group above
```

### `updates` fields

| Field | Required | Description |
|---|---|---|
| `package-ecosystem` | yes | One of the supported ecosystem names |
| `directory` | one of | Single directory to scan |
| `directories` | one of | List of directories to scan |
| `schedule` | yes* | Run schedule; required unless `multi-ecosystem-group` is set |
| `multi-ecosystem-group` | yes* | Name of a group defined in `multi-ecosystem-groups` |
| `groups` | no | Group packages by pattern for downstream use |
| `ignore` | no | Packages or update types to skip |

### `schedule` fields

| Field | Values | Description |
|---|---|---|
| `interval` | `daily`, `weekly`, `monthly` | How often to run |
| `day` | `monday` … `sunday` | Day of week (weekly only) |
| `time` | `"HH:MM"` | Time of day in 24h format |
| `timezone` | IANA timezone string | Defaults to UTC |

Longears uses a ±30 minute tolerance window when checking whether a schedule is due.

### `ignore` rules

```yaml
ignore:
  - dependency-name: express        # exact name or glob pattern
    versions: ["4.x"]               # specific versions to skip
    update-types: [major, minor]    # skip by semver bump type
```

Supported `update-types` values: `major`, `minor`, `patch`, `version-update:semver-major`, `version-update:semver-minor`, `version-update:semver-patch`.

## Inputs

| Name | Default | Description |
|---|---|---|
| `config-path` | `.github/longears.yml` | Path to the config file within the workspace |
| `workspace-dir` | `${{ github.workspace }}` | Root directory of the repository to scan |
| `force` | `false` | Run all ecosystems regardless of their schedule |
| `github-token` | `${{ github.token }}` | Token for GitHub Actions registry and API rate limits |
| `output-file` | `longears-results.json` | Where to write the JSON scan results |

## Outputs

| Name | Description |
|---|---|
| `results-path` | Absolute path to the JSON file containing all scan results |

## Output File Format

The output file is written to the runner's filesystem and is **temporary** — it is deleted when the job ends. To persist it, upload it as an artifact:

```yaml
- name: Upload scan results
  uses: actions/upload-artifact@v4
  with:
    name: longears-results
    path: ${{ steps.longears.outputs.results-path }}
    retention-days: 7  # adjust as needed; max 90 days
```

The action also exposes `results-path` as an output so downstream steps in the same job can read the file before it disappears.

Example JSON written to `output-file`:

```json
{
  "version": 1,
  "generated_at": "2026-04-18T16:00:00.000Z",
  "results": [
    {
      "ecosystem": "npm",
      "directory": "/",
      "scanned_at": "2026-04-18T16:00:01.234Z",
      "packages": [
        {
          "name": "axios",
          "current_version": "1.14.0",
          "latest_version": "1.15.0",
          "update_available": true,
          "dependency_type": "production",
          "registry_url": "https://www.npmjs.com/package/axios",
          "published_at": "2026-03-10T12:00:00.000Z"
        }
      ],
      "skipped_packages": 0
    }
  ]
}
```

## Development

```bash
# Install dependencies
npm install

# Type-check
npm run compile

# Build distributable bundle
npm run build

# Run tests
npm test

# Lint
npm run lint
```

The build step produces `dist/index.js` — the single bundled file referenced by `action.yml`.

## License

MIT
