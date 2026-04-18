import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

const BASE_URL = "https://rubygems.org/api/v1/gems";

export const rubygemsRegistry: RegistryClient = {
  async fetchMetadata(packageName: string): Promise<PackageMetadata | null> {
    const url = `${BASE_URL}/${encodeURIComponent(packageName)}.json`;
    try {
      const response = await axios.get<{
        version: string;
        version_created_at?: string;
      }>(url, { timeout: 10_000 });

      const latestVersion = response.data.version;
      if (!latestVersion) return null;

      return {
        name: packageName,
        latestVersion,
        registryUrl: url,
        publishedAt: response.data.version_created_at,
      };
    } catch {
      return null;
    }
  },
};
