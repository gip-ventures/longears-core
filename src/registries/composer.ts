import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

const BASE_URL = "https://packagist.org/packages";

export const composerRegistry: RegistryClient = {
  async fetchMetadata(packageName: string): Promise<PackageMetadata | null> {
    const url = `${BASE_URL}/${packageName}.json`;
    try {
      const response = await axios.get<{
        package: {
          versions: Record<
            string,
            { version: string; time?: string }
          >;
        };
      }>(url, { timeout: 10_000 });

      const versions = response.data.package?.versions ?? {};
      // Find the latest stable version (exclude dev- and branches)
      const stableVersions = Object.values(versions)
        .filter((v) => !v.version.includes("dev") && /^\d/.test(v.version))
        .sort((a, b) => compareVersions(b.version, a.version));

      const latest = stableVersions[0];
      if (!latest) return null;

      return {
        name: packageName,
        latestVersion: latest.version,
        registryUrl: `https://packagist.org/packages/${packageName}`,
        publishedAt: latest.time,
      };
    } catch {
      return null;
    }
  },
};

function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
