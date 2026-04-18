import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

export const dockerRegistry: RegistryClient = {
  async fetchMetadata(imageName: string): Promise<PackageMetadata | null> {
    // Normalize image name: "nginx" → "library/nginx", "user/image" stays
    const normalizedName = imageName.includes("/")
      ? imageName
      : `library/${imageName}`;

    // Detect GHCR images
    if (imageName.startsWith("ghcr.io/")) {
      return fetchGhcrLatest(imageName);
    }

    const url = `https://hub.docker.com/v2/repositories/${normalizedName}/tags?page_size=10&ordering=last_updated`;
    try {
      const response = await axios.get<{
        results: Array<{ name: string; last_updated: string }>;
      }>(url, { timeout: 10_000 });

      const tags = response.data.results ?? [];
      // Prefer a non-latest semver tag over "latest"
      const versionedTag = tags.find(
        (t) => t.name !== "latest" && /^\d/.test(t.name)
      );
      const chosen = versionedTag ?? tags[0];

      if (!chosen) return null;

      return {
        name: imageName,
        latestVersion: chosen.name,
        registryUrl: `https://hub.docker.com/r/${normalizedName}/tags`,
        publishedAt: chosen.last_updated,
      };
    } catch {
      return null;
    }
  },
};

async function fetchGhcrLatest(imageName: string): Promise<PackageMetadata | null> {
  // GHCR does not expose an unauthenticated public tags API easily.
  // We return null so the caller can log it as unresolvable without a token.
  return null;
}
