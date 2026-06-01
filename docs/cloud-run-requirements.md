# Cloud Run Implementation Requirements

## Context

Longears currently runs as a GitHub Action: a scheduled workflow checks out a repository,
runs the Node process, and writes `longears-results.json` to the workspace. The action
already has two optional inputs — `api-key` and `api-endpoint` — that POST the report
to an external ingest endpoint when set.

A Cloud Run deployment makes Longears a persistent HTTP service that can be triggered
by Cloud Scheduler or webhook, removing the dependency on a GitHub Actions runner for
every scan.

---

## What Needs to Be Built

### 1. HTTP Entry Point

Replace `@actions/core.getInput()` calls in `src/main.ts` with an Express (or Node
`http`) request handler. The service must expose:

- `POST /scan` — run a dependency scan
- `GET /health` — liveness probe for Cloud Run

**Request body (`POST /scan`):**
```json
{
  "config_path":   ".github/longears.yml",
  "workspace_dir": "/workspace",
  "force":         false,
  "github_token":  "ghp_...",
  "output_file":   "longears-results.json"
}
```

All fields mirror the existing action inputs; `workspace_dir` must point to a directory
already mounted or cloned before the request is issued.

**Response:** the full `ScanReport` JSON on success, or `{ "error": "..." }` with an
appropriate HTTP status on failure.

### 2. Repository Cloning

The action relies on the GitHub Actions runner to check out the repository before it
runs. Cloud Run has no such pre-step. Two options:

- **Option A (simpler):** Accept an additional `repository_url` field in the request
  body; the service clones the repo to a temp directory, runs the scan, then deletes
  the clone.
- **Option B (volume mount):** Require the caller to mount a pre-populated volume at
  `workspace_dir`. Keeps the service stateless but shifts the cloning concern to the
  caller (e.g., a Cloud Build step).

Option A is recommended for self-contained deployments; Option B for pipelines that
already manage checkouts.

### 3. Authentication

| Secret | Current source | Cloud Run source |
|---|---|---|
| `github-token` | `${{ github.token }}` automatic | Request body field OR `GITHUB_TOKEN` env var |
| `api-key` | Action input | `API_KEY` env var (verified against `Authorization: Bearer` on incoming requests) |

The service should reject requests missing a valid `api-key` when the env var is set,
allowing the endpoint to be locked down.

### 4. Logging

Replace all `core.info()` / `core.warning()` / `core.setFailed()` calls with
`console.log()` / `console.error()` writing structured JSON lines so Cloud Logging
can index them:

```json
{ "severity": "INFO",  "message": "..." }
{ "severity": "ERROR", "message": "...", "error": "..." }
```

### 5. Scheduling

Cloud Scheduler issues an authenticated `POST /scan` to the service on whatever
cron cadence is required. The existing `isUpdateDue()` logic in `scheduler.ts`
remains unchanged — it still decides which ecosystems actually run on each invocation.
No changes to `scheduler.ts` are needed.

### 6. Container Image

Minimum `Dockerfile`:
```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/index.js ./dist/
CMD ["node", "dist/index.js"]
```

`npm run build` must be re-run and `dist/index.js` committed before building the image,
consistent with the existing build convention.

**Environment variables read at runtime:**
- `PORT` — Cloud Run injects this; service must listen on it (default `8080`)
- `GITHUB_TOKEN` — fallback when not supplied in request body
- `API_KEY` — when set, requires matching `Authorization: Bearer` on all `/scan` requests

---

## What Does NOT Change

- All 14 manifest parsers (`src/manifest-parsers/`) — no changes needed
- All 14 registry clients (`src/registries/`) — no changes needed
- Config parser and Zod schema (`src/config/`) — no changes needed
- Scheduler logic (`src/scheduler.ts`) — no changes needed
- Output JSON schema (`src/metadata-logger.ts`) — no changes needed
- `npm run build` convention: always regenerate and commit `dist/index.js`

---

## Out of Scope

- Opening pull requests (not Longears' responsibility per design)
- Storing scan history (downstream concern; service returns the report, caller persists it)
- Multi-tenant isolation (single-tenant deployment assumed)
