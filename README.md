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

### Push trigger

You can add a `push` trigger so Longears also runs immediately when a manifest file is changed, rather than waiting for the next cron tick. Set `force: true` on push events so the per-ecosystem schedule gate is bypassed — otherwise runs landing outside the configured time window are silently skipped.

Include only the manifest file patterns for the ecosystems you have configured. The example below covers all 14 supported ecosystems; trim it to match your `longears.yml`.

```yaml
on:
  schedule:
    - cron: "0 * * * *"
  workflow_dispatch:
    inputs:
      force:
        description: Run all ecosystems regardless of their configured schedule
        type: boolean
        default: false
  push:
    branches:
      - main
    paths:
      - "package.json"
      - "requirements.txt"
      - "requirements/**/*.txt"
      - "requirements-*.txt"
      - "Pipfile"
      - "pyproject.toml"
      - "Gemfile"
      - "Gemfile.lock"
      - "pom.xml"
      - "**/pom.xml"
      - "go.mod"
      - "composer.json"
      - "**/*.csproj"
      - "**/*.fsproj"
      - "**/*.vbproj"
      - "**/packages.config"
      - "**/Directory.Packages.props"
      - "global.json"
      - "Dockerfile"
      - "Dockerfile.*"
      - "*.dockerfile"
      - "docker-compose.yml"
      - "docker-compose.yaml"
      - "mix.exs"
      # .github/workflows/*.yml is intentionally omitted — including it would
      # cause this workflow to retrigger itself on every edit; the hourly cron
      # already covers the github-actions ecosystem
      - "pubspec.yaml"
      - "pubspec.yml"
      - ".devcontainer/devcontainer.json"
      - ".devcontainer.json"
      - ".devcontainer/**/devcontainer.json"
      - ".gitmodules"

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
          # On push: bypass schedule gate. On workflow_dispatch: respect checkbox.
          force: ${{ github.event_name == 'push' && 'true' || inputs.force || 'false' }}
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

The action writes a JSON file at the path specified by `output-file`. Example:

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

## Versioning

Longears follows the [GitHub Actions versioning convention](https://docs.github.com/en/actions/sharing-automations/creating-actions/about-custom-actions#using-release-management-for-actions) using a mutable major-version tag (`v1`) that always points to the latest stable commit on that major version.

### Recommended: pin to the major version tag

```yaml
uses: gip-ventures/longears-core@v1
```

This is the standard approach. The `v1` tag is force-updated with every release, so your workflow automatically picks up bug fixes and new features without any changes on your end.

### Pin to a specific commit SHA

```yaml
uses: gip-ventures/longears-core@3f3ef404a787497e6d146e28279bca82e32d2c40
```

Use this when you need reproducible runs and want to opt in to upgrades manually. Copy the full 40-character SHA from the [commits page](https://github.com/gip-ventures/longears-core/commits/main).

### Keeping the `v1` tag current (maintainers)

After merging changes that should be released, force-move the `v1` tag to the new HEAD:

```bash
git tag -f v1 <commit-sha>
git push origin v1 --force
```

This is intentional — consumers referencing `@v1` receive the update on their next run.

## Debugging

Set the `ACTIONS_STEP_DEBUG` secret to `true` in your repository (Settings → Secrets and variables → Actions) to enable debug logging for the action run. When enabled, Longears emits additional log lines showing which files are globbed, how many dependencies are parsed per file, how many duplicates are removed, and which packages are skipped because the registry returned no data.

```yaml
steps:
  - name: Run Longears
    uses: gip-ventures/longears-core@v1
    env:
      ACTIONS_STEP_DEBUG: true   # or set as a repository secret
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
