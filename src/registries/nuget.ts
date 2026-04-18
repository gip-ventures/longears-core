import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

const BASE_URL = "https://api.nuget.org/v3-flatcontainer";

export const nugetRegistry: RegistryClient = {
  async fetchMetadata(packageName: string): Promise<PackageMetadata | null> {
    const lowered = packageName.toLowerCase();
    const url = `${BASE_URL}/${encodeURIComponent(lowered)}/index.json`;
    try {
      const response = await axios.get<{ versions: string[] }>(url, {
        timeout: 10_000,
      });

      const versions = response.data.versions ?? [];
      // Filter stable versions (no pre-release suffixes)
      const stable = versions.filter((v) => !v.includes("-"));
      const latestVersion = stable[stable.length - 1] ?? versions[versions.length - 1];

      if (!latestVersion) return null;

      return {
        name: packageName,
        latestVersion,
        registryUrl: `https://www.nuget.org/packages/${packageName}`,
      };
    } catch {
      return null;
    }
  },
};
