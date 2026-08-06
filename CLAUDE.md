# CLAUDE.md

## Project Overview

**Longears** is a TypeScript/Node.js GitHub Action (Node 24.15, entrypoint `dist/index.js`) that reads a `longears.yml` configuration file, determines which package ecosystems should run, globs their manifest files, deduplicates dependencies by name (first-occurrence wins), and queries each registry in parallel via `Promise.allSettled()`. Results are written to a JSON file.

**Trigger modes:** which ecosystems run is gated by the event that started the run, controlled by the top-level `trigger` config field (default `[schedule]`):
- **schedule** (cron / `workflow_dispatch`) — each ecosystem runs on its own configured schedule (`isUpdateDue()` in `scheduler.ts`).
- **pull_request** / **push_default** (push to the default branch) — Longears asks the GitHub API which files changed (`changed-files.ts`), and runs an ecosystem only when one of its manifest files changed (`matchChangedManifests()`). The whole ecosystem is scanned if any of its manifests changed.

`src/trigger.ts` resolves the active event from the runner env; `force` overrides both gates.

**Scope boundary:** Longears only collects dependency metadata. It does not open pull requests — that is a downstream concern.

> **Critical:** `dist/index.js` is the compiled bundle used directly by the action runtime. It is committed to the repository and must be regenerated and committed alongside every source change.

---

## Repository Layout

```
longears-core/
  action.yml                    # GitHub Action metadata; runtime=node24, main=dist/index.js
  dist/
    index.js                    # Committed esbuild bundle — do NOT gitignore this file
  src/
    main.ts                     # Entry point — orchestration only, no parsing/registry logic
    scheduler.ts                # isScheduleDue(), resolveSchedule(), resolveDirectories()
    trigger.ts                  # readTriggerContext(), resolveTriggerEvent() — event → mode
    changed-files.ts            # getChangedFiles() (GitHub API), matchChangedManifests()
    metadata-logger.ts          # buildReport(), logReport(), writeReportFile(); output types
    config/
      parser.ts                 # parseConfig() — reads YAML, validates via Zod
      types.ts                  # TypeScript types: Ecosystem, LongearsConfig, Schedule, etc.
    manifest-parsers/
      types.ts                  # ManifestParser interface + Dependency type
      index.ts                  # getParser(ecosystem) dispatcher
      bundler.ts, composer.ts, devcontainers.ts, docker.ts, dotnet-sdk.ts,
      github-actions.ts, gitsubmodule.ts, gomod.ts, maven.ts, mix.ts,
      npm.ts, nuget.ts, pip.ts, pub.ts
    registries/
      types.ts                  # RegistryClient interface + PackageMetadata type
      index.ts                  # getRegistry(ecosystem, token) dispatcher
      composer.ts, devcontainers.ts, docker.ts, dotnet-sdk.ts, github-actions.ts,
      gitsubmodule.ts, gomod.ts, maven.ts, mix.ts, npm.ts, nuget.ts,
      pub.ts, pypi.ts, rubygems.ts
  .github/
    longears.yml                # Self-dogfood config (npm, weekly Sunday 16:00)
    workflows/
      self-update.yml           # Runs Longears on itself hourly; uploads artifact
  examples/
    README.md                   # Placement guide for the two example files
    longears.yml                # Example Longears config (multi-ecosystem-groups, npm)
    dependency-scan.yml         # Example GitHub Actions workflow for running Longears
```

---

## Key Interfaces

```typescript
// src/manifest-parsers/types.ts
interface ManifestParser {
  filePatterns: string[];  // glob patterns relative to the scanned directory
  parse(filePath: string, content: string): Dependency[];
}

interface Dependency {
  name: string;
  currentVersion: string | null;
  dependencyType: "production" | "development" | "unknown";
}
```

```typescript
// src/registries/types.ts
interface RegistryClient {
  fetchMetadata(packageName: string, currentVersion?: string | null): Promise<PackageMetadata | null>;
}

interface PackageMetadata {
  name: string;
  latestVersion: string;
  registryUrl: string;
  publishedAt?: string;
}
```

**Factory pattern:** Two registries require a GitHub token and export factory functions instead of singletons:
- `createGithubActionsRegistry(token: string): RegistryClient` — `src/registries/github-actions.ts`
- `createGitsubmoduleRegistry(token: string): RegistryClient` — `src/registries/gitsubmodule.ts`

Any new ecosystem requiring authentication must follow this factory pattern.

**Singleton exception:** `dotnet-sdk` always emits a single `Dependency` with `name: "dotnet-sdk"` and the registry ignores `packageName` entirely, fetching the global latest SDK from Microsoft's release index.

---

## Ecosystem Inventory

14 supported ecosystems. Note the naming asymmetry between config values, parser files, and registry files:

| Config name (`package-ecosystem`) | Parser file | Registry file | Registry endpoint |
|---|---|---|---|
| `bundler` | `bundler.ts` | `rubygems.ts` | rubygems.org |
| `composer` | `composer.ts` | `composer.ts` | packagist.org |
| `devcontainers` | `devcontainers.ts` | `devcontainers.ts` | delegates to docker registry |
| `docker` | `docker.ts` | `docker.ts` | Docker Hub (GHCR returns null) |
| `dotnet-sdk` | `dotnet-sdk.ts` | `dotnet-sdk.ts` | dotnetcli.blob.core.windows.net |
| `github-actions` | `github-actions.ts` | `github-actions.ts` | GitHub Releases/Tags API (factory) |
| `gitsubmodule` | `gitsubmodule.ts` | `gitsubmodule.ts` | GitHub Commits API (factory) |
| `gomod` | `gomod.ts` | `gomod.ts` | proxy.golang.org |
| `maven` | `maven.ts` | `maven.ts` | search.maven.org |
| `mix` | `mix.ts` | `mix.ts` | hex.pm |
| `npm` | `npm.ts` | `npm.ts` | registry.npmjs.org |
| `nuget` | `nuget.ts` | `nuget.ts` | api.nuget.org |
| `pip` | `pip.ts` | `pypi.ts` | pypi.org |
| `pub` | `pub.ts` | `pub.ts` | pub.dev |

> There is no `rubygems` ecosystem name — users configure `bundler`, which internally queries rubygems.org.

---

## Dev Commands

```bash
npm run build     # tsc --noEmit (type-check) + esbuild bundle → dist/index.js
npm run compile   # tsc full compile to dist/ (NOT the action bundle — rarely needed)
npm test          # Jest via ts-jest; test files: src/__tests__/**/*.test.ts
npm run lint      # ESLint on src/**/*.ts
```

> **Always use `npm run build`** before committing. `npm run compile` emits TypeScript output to `dist/` but does not produce the `dist/index.js` bundle that the action runtime uses.

After any source change, the commit workflow is:
1. `npm run build`
2. Stage both `src/` changes and `dist/index.js`
3. Commit them together

---

## Code Conventions

**Naming**
- Files: `lowercase-hyphen.ts` (e.g., `dotnet-sdk.ts`, `github-actions.ts`)
- Types/interfaces: `PascalCase`
- Functions and variables: `camelCase`
- YAML config keys: `kebab-case` (e.g., `package-ecosystem`, `multi-ecosystem-group`)

**Error handling**
- Registry `fetchMetadata()` must return `null` on any error — never throw. The `Promise.allSettled()` loop in `main.ts` provides a second safety net.
- Parser `parse()` must return `[]` on any error — never throw.
- Catch blocks coerce errors with `String(err)` for logging (e.g., `core.setFailed(\`...: ${String(err)}\`)`).

**Async**
- `async/await` throughout.
- `Promise.allSettled()` for parallel registry fetches — **do not change to `Promise.all()`**. A single registry timeout or 404 must not abort the entire scan.

**HTTP**
- All Axios calls must include `{ timeout: 10_000 }` — no exceptions.
- Encode package names in URLs with `encodeURIComponent()`.

**TypeScript**
- Strict mode enabled; all options in `tsconfig.json`.
- Target: ES2022, module system: CommonJS.
- Unused interface implementation parameters are prefixed with `_` (e.g., `_filePath`).

**Version parsing**
- Each ecosystem file has its own private `cleanVersion()` helper — there is no shared utility. Keep version cleaning local to the file.

---

## Adding a New Ecosystem

1. **Create the manifest parser** at `src/manifest-parsers/<ecosystem-name>.ts`:

```typescript
import type { Dependency, ManifestParser } from "./types";

export const myEcosystemParser: ManifestParser = {
  filePatterns: ["manifest-file.ext"],
  parse(_filePath: string, content: string): Dependency[] {
    // Return [] on any parse error, never throw
    return [];
  },
};
```

2. **Create the registry client** at `src/registries/<service-name>.ts` (name may differ from ecosystem — see table above):

```typescript
// No-auth singleton:
import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

export const myRegistry: RegistryClient = {
  async fetchMetadata(packageName: string): Promise<PackageMetadata | null> {
    try {
      const url = `https://example.com/${encodeURIComponent(packageName)}`;
      const { data } = await axios.get(url, { timeout: 10_000 });
      return { name: packageName, latestVersion: data.version, registryUrl: url };
    } catch {
      return null;
    }
  },
};

// Auth-required factory:
export function createMyRegistry(token: string): RegistryClient {
  return {
    async fetchMetadata(packageName: string): Promise<PackageMetadata | null> {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        // ...
        return null;
      } catch {
        return null;
      }
    },
  };
}
```

3. **Register the parser** in `src/manifest-parsers/index.ts` — add import and entry to `PARSERS`.

4. **Register the registry** in `src/registries/index.ts` — add import and `case` to `getRegistry()`. For factory clients, call `createMyRegistry(githubToken)`.

5. **Add to the `Ecosystem` type** in `src/config/types.ts`:
```typescript
export type Ecosystem = | "bundler" | ... | "my-ecosystem";
```

6. **Add to the Zod enum** in `src/config/parser.ts` — the `z.enum([...])` inside `updateConfigSchema["package-ecosystem"]`:
```typescript
"package-ecosystem": z.enum(["bundler", ..., "my-ecosystem"]),
```
> **The TypeScript type and the Zod enum are maintained separately** — missing either causes a type error or a runtime validation failure.

7. **Build and commit**:
```bash
npm run build
git add src/ dist/index.js
git commit -m "feat: add <ecosystem> ecosystem support"
```

---

## Configuration Reference

```yaml
version: 2  # must be exactly the integer 2

trigger: [schedule, pull_request, push_default]  # optional; default [schedule]
# schedule     — cron/workflow_dispatch runs use per-ecosystem schedules
# pull_request — run ecosystems whose manifests changed in the PR
# push_default — same, for pushes/merges to the default branch
# Events not listed here are ignored (the run exits writing an empty report).

multi-ecosystem-groups:
  group-name:
    schedule:
      interval: weekly      # daily | weekly | monthly
      day: monday           # weekly only: monday–sunday
      time: "09:00"         # HH:MM format, evaluated in UTC (±30 min tolerance)
      timezone: "UTC"       # accepted and validated but NOT applied — scheduler always uses UTC

updates:
  - package-ecosystem: npm  # must be one of the 14 ecosystem names above
    directory: /            # root-relative; use directory OR directories (not both)
    directories: [/a, /b]  # plural form; takes precedence if both are present
    schedule:
      interval: daily
      time: "00:00"
    multi-ecosystem-group: group-name  # use group's schedule instead of own
    groups:
      my-group:
        patterns: ["*"]
        exclude-patterns: ["lodash"]
        dependency-type: production    # production | development
        update-types: [major, minor, patch]
    ignore:
      - dependency-name: express
        versions: ["4.x"]
        update-types: [major]
```

---

## Output Format

Written to `longears-results.json` (gitignored) by `src/metadata-logger.ts`:

```typescript
{
  version: 1,                    // always the integer 1
  generated_at: string,          // ISO 8601
  results: [
    {
      ecosystem: string,
      directory: string,
      scanned_at: string,        // ISO 8601
      packages: [
        {
          name: string,
          current_version: string | null,
          latest_version: string,
          update_available: boolean,
          dependency_type: string,   // "production" | "development" | "unknown"
          registry_url: string,
          published_at?: string      // ISO 8601; absent if registry doesn't provide it
        }
      ],
      skipped_packages?: number,    // count of packages where registry returned null
      triggered_by_files?: string[] // changed manifest paths that triggered this scan
                                    // (changed-files mode only; absent in schedule mode)
    }
  ]
}
```

---

## CI/CD Notes

**Workflow:** `.github/workflows/self-update.yml`
- Triggers: hourly cron (`0 * * * *`), `pull_request`, `push` to the default branch, and `workflow_dispatch` (with optional `force` input)
- Uses `uses: ./` — the local action ref, which means it always tests the committed `dist/index.js`
- Requires only `contents: read` permission
- Uploads results as a `longears-results` artifact (7-day retention); nothing is committed back
- `longears-results.json` is gitignored

The hourly cron fires every hour; per-ecosystem schedules in `.github/longears.yml` control which ecosystems actually execute each scheduled run. On `pull_request` / `push` events the action runs in changed-files mode instead — only ecosystems with a changed manifest are scanned. The `trigger` field in `.github/longears.yml` must include the corresponding mode for the event to do anything; the workflow `on:` filters and the config `trigger` list are maintained together.

**Push trigger paths must stay in sync with parser `filePatterns`:** The push-based usage option documented in `README.md` contains a `paths:` allowlist that is a manual mirror of the `filePatterns` arrays in `src/manifest-parsers/`. When adding a new ecosystem, add its file patterns to the README push-trigger example. Note: `.github/workflows/*.yml` is deliberately omitted from the push paths to prevent the workflow from retriggering itself — the github-actions ecosystem is not covered by the push-based option.

---

## Known Gaps and AI Guidance

**Things that look wrong but aren't:**
- `pypi.ts` and `rubygems.ts` in the registries folder — correct; they're named after the service, not the config ecosystem key (`pip`/`bundler`)
- `devcontainersRegistry` fully delegates to `dockerRegistry` — intentional; devcontainers use OCI images
- `dotnet-sdk` registry ignoring `packageName` — intentional singleton; always fetches the global latest SDK channel

**Known limitations — do not silently fix:**
- `timezone` in schedule config is parsed and validated by Zod but `isWithinTimeWindow()` in `scheduler.ts` uses `getUTCHours()` / `getUTCMinutes()` regardless. Fixing this requires updating the scheduler — confirm intent before doing so.
- GHCR images in the docker registry always return `null` (intentional stub in `fetchGhcrLatest`).

**Before every commit with source changes:**
1. Run `npm run build` (not `compile`) to regenerate `dist/index.js`
2. Commit `dist/index.js` together with the source changes

**When adding an ecosystem, update both independently:**
- `Ecosystem` type union in `src/config/types.ts`
- Zod `.enum([...])` in `src/config/parser.ts`

**Do not change `Promise.allSettled()` to `Promise.all()`** in the registry fetch loop in `main.ts` — one slow or broken registry must not abort the entire scan.

**Tests** live at `src/__tests__/<name>.test.ts` to match Jest's configured `testMatch` pattern (e.g. `trigger.test.ts`, `changed-files.test.ts`). `tsconfig.json` includes `jest` in `types` so ts-jest sees the globals; keep test files out of the build via the existing `**/__tests__/**` exclude. Prefer pure, network-free units (e.g. `resolveTriggerEvent`, `matchChangedManifests`).
