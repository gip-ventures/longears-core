import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

const BASE_URL = "https://pub.dev/api/packages";

export const pubRegistry: RegistryClient = {
  async fetchMetadata(packageName: string): Promise<PackageMetadata | null> {
    const url = `${BASE_URL}/${encodeURIComponent(packageName)}`;
    try {
      const response = await axios.get<{
        latest: { version: string; published?: string };
      }>(url, { timeout: 10_000 });

      const latestVersion = response.data.latest?.version;
      if (!latestVersion) return null;

      return {
        name: packageName,
        latestVersion,
        registryUrl: `https://pub.dev/packages/${packageName}`,
        publishedAt: response.data.latest.published,
      };
    } catch {
      return null;
    }
  },
};
