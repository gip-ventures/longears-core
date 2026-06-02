import * as fs from "fs";
import axios from "axios";
import minimatch from "minimatch";

interface FileEntry {
  filename?: string;
}

interface EventPayload {
  pull_request?: { number?: number };
  before?: string;
  after?: string;
}

const ZERO_SHA = /^0+$/;

/**
 * Resolves the list of files changed by the event that triggered this run,
 * using the GitHub API (no reliance on local git history / fetch-depth).
 *
 * Returns repo-relative POSIX paths. On any error — or for events that don't
 * describe a file change — returns an empty array (never throws), matching the
 * project's registry/parser error-handling convention.
 */
export async function getChangedFiles(token: string): Promise<string[]> {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const repo = process.env.GITHUB_REPOSITORY;
  const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";

  if (!eventPath || !repo) return [];

  let payload: EventPayload;
  try {
    payload = JSON.parse(fs.readFileSync(eventPath, "utf8")) as EventPayload;
  } catch {
    return [];
  }

  const [owner, name] = repo.split("/");
  if (!owner || !name) return [];

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    if (eventName === "pull_request" || eventName === "pull_request_target") {
      const number = payload.pull_request?.number;
      if (!number) return [];
      return await listPullRequestFiles(apiBase, owner, name, number, headers);
    }

    if (eventName === "push") {
      const before = payload.before ?? "";
      const after = payload.after ?? "";
      if (!after || ZERO_SHA.test(after)) return []; // branch deletion
      if (!before || ZERO_SHA.test(before)) {
        // New branch: no diff base — use the head commit's file list.
        return await listCommitFiles(apiBase, owner, name, after, headers);
      }
      return await listCompareFiles(apiBase, owner, name, before, after, headers);
    }
  } catch {
    return [];
  }

  return [];
}

async function listPullRequestFiles(
  apiBase: string,
  owner: string,
  name: string,
  number: number,
  headers: Record<string, string>
): Promise<string[]> {
  const files: string[] = [];
  const base = `${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${number}/files`;
  for (let page = 1; page <= 100; page++) {
    const url = `${base}?per_page=100&page=${page}`;
    const { data } = await axios.get<FileEntry[]>(url, { headers, timeout: 10_000 });
    if (!Array.isArray(data) || data.length === 0) break;
    for (const f of data) if (f.filename) files.push(f.filename);
    if (data.length < 100) break;
  }
  return files;
}

async function listCompareFiles(
  apiBase: string,
  owner: string,
  name: string,
  base: string,
  head: string,
  headers: Record<string, string>
): Promise<string[]> {
  const url = `${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/compare/${base}...${head}`;
  const { data } = await axios.get<{ files?: FileEntry[] }>(url, { headers, timeout: 10_000 });
  return (data.files ?? []).map((f) => f.filename).filter((n): n is string => !!n);
}

async function listCommitFiles(
  apiBase: string,
  owner: string,
  name: string,
  sha: string,
  headers: Record<string, string>
): Promise<string[]> {
  const url = `${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits/${sha}`;
  const { data } = await axios.get<{ files?: FileEntry[] }>(url, { headers, timeout: 10_000 });
  return (data.files ?? []).map((f) => f.filename).filter((n): n is string => !!n);
}

/** Strips leading/trailing slashes so "/", "/sub/", "sub" all normalize cleanly. */
function normalizeDir(directory: string): string {
  return directory.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Returns the subset of changed files that are manifest files for the given
 * ecosystem, by matching each changed path (relative to a configured directory)
 * against the ecosystem's glob patterns. Uses the same glob semantics as the
 * scan: bare patterns match only at the directory root, `**` matches nested
 * paths. Empty result means the ecosystem has no changed manifests.
 */
export function matchChangedManifests(
  changedFiles: string[],
  directories: string[],
  filePatterns: string[]
): string[] {
  const matched = new Set<string>();

  for (const file of changedFiles) {
    for (const directory of directories) {
      const prefix = normalizeDir(directory);

      let relative: string;
      if (prefix === "") {
        relative = file;
      } else if (file.startsWith(`${prefix}/`)) {
        relative = file.slice(prefix.length + 1);
      } else {
        continue; // file is not under this directory
      }

      const isMatch = filePatterns.some((pattern) =>
        minimatch(relative, pattern, { dot: true })
      );
      if (isMatch) {
        matched.add(file);
        break;
      }
    }
  }

  return [...matched];
}
