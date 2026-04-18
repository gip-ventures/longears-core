import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

const BASE_URL = "https://hex.pm/api/packages";

export const mixRegistry: RegistryClient = {
  async fetchMetadata(packageName: string): Promise<PackageMetadata | null> {
    const url = `${BASE_URL}/${encodeURIComponent(packageName)}`;
    try {
      const response = await axios.get<{
        releases: Array<{ version: string; inserted_at?: string }>;
      }>(url, { timeout: 10_000 });

      const releases = response.data.releases ?? [];
      const latest = releases[0];
      if (!latest) return null;

      return {
        name: packageName,
        latestVersion: latest.version,
        registryUrl: `https://hex.pm/packages/${packageName}`,
        publishedAt: latest.inserted_at,
      };
    } catch {
      return null;
    }
  },
};
