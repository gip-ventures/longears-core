import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

const BASE_URL = "https://pypi.org/pypi";

export const pypiRegistry: RegistryClient = {
  async fetchMetadata(packageName: string): Promise<PackageMetadata | null> {
    const url = `${BASE_URL}/${encodeURIComponent(packageName)}/json`;
    try {
      const response = await axios.get<{
        info: { version: string };
        urls?: Array<{ upload_time_iso_8601?: string }>;
      }>(url, { timeout: 10_000 });

      const latestVersion = response.data.info?.version;
      if (!latestVersion) return null;

      const publishedAt = response.data.urls?.[0]?.upload_time_iso_8601;

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
