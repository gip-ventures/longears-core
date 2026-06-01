# Cloud Run Ingest Service — Requirements

## What This Is

A standalone Python Cloud Run service (separate repository) that receives dependency
scan reports from the Longears GitHub Action and processes them further.

The Longears action already supports delivery: when `api-key` and `api-endpoint` inputs
are configured, it POSTs the completed scan report to that URL with
`Authorization: Bearer <api-key>`. The Cloud Run service is the receiving end of that
call.

---

## Ingest Endpoint

**`POST /ingest`**

Receives the Longears scan report after every successful action run.

### Authentication

All requests must carry the header:
```
Authorization: Bearer <api-key>
```
The service validates the key against a secret stored in Secret Manager (or an env var).
Requests with a missing or wrong key return `401`.

### Request Body

The exact JSON the Longears action sends (`ScanReport` v1):

```json
{
  "version": 1,
  "generated_at": "2026-06-01T12:00:00.000Z",
  "results": [
    {
      "ecosystem": "npm",
      "directory": "/",
      "scanned_at": "2026-06-01T12:00:01.000Z",
      "packages": [
        {
          "name": "express",
          "current_version": "4.18.2",
          "latest_version": "4.19.0",
          "update_available": true,
          "dependency_type": "production",
          "registry_url": "https://registry.npmjs.org/express",
          "published_at": "2024-03-01T10:00:00.000Z"
        }
      ],
      "skipped_packages": 0
    }
  ]
}
```

Field notes:
- `version` is always the integer `1`
- `current_version` may be `null` if the manifest didn't pin a version
- `published_at` is optional — not all registries provide it
- `skipped_packages` counts packages where the registry returned no data

### Response

- `200` — report accepted and processed
- `400` — malformed payload
- `401` — missing or invalid API key
- `500` — internal error

---

## Further Processing (to be defined)

The service receives the report and should do one or more of the following — exact
behaviour to be specified before implementation:

- Store results (e.g. BigQuery, Firestore, Cloud Storage)
- Trigger notifications (e.g. Slack, email) when `update_available: true` packages
  exceed a threshold
- Expose a read API for dashboards
- Deduplicate or diff against a previous scan

---

## Connecting the Action

In the repository running Longears, set these two inputs in the workflow:

```yaml
- uses: gip-ventures/longears-core@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    api-key:      ${{ secrets.LONGEARS_API_KEY }}
    api-endpoint: https://<cloud-run-url>/ingest
```

The action will POST the report to the service after every scan.
