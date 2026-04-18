import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

export function createGithubActionsRegistry(token: string): RegistryClient {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  return {
    async fetchMetadata(actionRef: string): Promise<PackageMetadata | null> {
      // actionRef is "owner/repo" or "owner/repo/path"
      const parts = actionRef.split("/");
      if (parts.length < 2) return null;

      const owner = parts[0];
      const repo = parts[1];

      const releasesUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
      try {
        const response = await axios.get<{
          tag_name: string;
          published_at?: string;
        }>(releasesUrl, { headers, timeout: 10_000 });

        return {
          name: actionRef,
          latestVersion: response.data.tag_name,
          registryUrl: `https://github.com/${owner}/${repo}/releases`,
          publishedAt: response.data.published_at,
        };
      } catch {
        // Fall back to tags if no releases exist
        try {
          const tagsUrl = `https://api.github.com/repos/${owner}/${repo}/tags`;
          const tagsResponse = await axios.get<
            Array<{ name: string }>
          >(tagsUrl, { headers, timeout: 10_000 });

          const latestTag = tagsResponse.data[0];
          if (!latestTag) return null;

          return {
            name: actionRef,
            latestVersion: latestTag.name,
            registryUrl: `https://github.com/${owner}/${repo}/tags`,
          };
        } catch {
          return null;
        }
      }
    },
  };
}
