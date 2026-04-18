import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

const BASE_URL = "https://registry.npmjs.org";

export const npmRegistry: RegistryClient = {
  async fetchMetadata(packageName: string): Promise<PackageMetadata | null> {
    const encodedName = encodeURIComponent(packageName).replace("%40", "@");
    const url = `${BASE_URL}/${encodedName}`;
    try {
      const response = await axios.get<{
        "dist-tags": { latest: string };
        time?: Record<string, string>;
      }>(url, { timeout: 10_000 });

      const latestVersion = response.data["dist-tags"]?.latest;
      if (!latestVersion) return null;

      const publishedAt = response.data.time?.[latestVersion];

      return {
        name: packageName,
        latestVersion,
        registryUrl: url,
        publishedAt,
      };
    } catch {
      return null;
    }
  },
};
