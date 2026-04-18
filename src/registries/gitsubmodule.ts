import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

export function createGitsubmoduleRegistry(token: string): RegistryClient {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  return {
    async fetchMetadata(repoUrl: string): Promise<PackageMetadata | null> {
      // Extract owner/repo from GitHub URLs
      const ghMatch = repoUrl.match(
        /github\.com[/:]([^/]+)\/([^/.\s]+?)(?:\.git)?$/
      );
      if (!ghMatch) return null;

      const owner = ghMatch[1];
      const repo = ghMatch[2];

      try {
        const response = await axios.get<{ sha: string; commit: { committer: { date?: string } } }>(
          `https://api.github.com/repos/${owner}/${repo}/commits/HEAD`,
          { headers, timeout: 10_000 }
        );

        return {
          name: repoUrl,
          latestVersion: response.data.sha.slice(0, 7),
          registryUrl: `https://github.com/${owner}/${repo}`,
          publishedAt: response.data.commit?.committer?.date,
        };
      } catch {
        return null;
      }
    },
  };
}
