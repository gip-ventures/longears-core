import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

const SEARCH_URL = "https://search.maven.org/solrsearch/select";

export const mavenRegistry: RegistryClient = {
  async fetchMetadata(packageName: string): Promise<PackageMetadata | null> {
    // packageName format: "groupId:artifactId"
    const [groupId, artifactId] = packageName.split(":");
    if (!groupId || !artifactId) return null;

    const query = `g:${groupId} AND a:${artifactId}`;
    const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&rows=1&wt=json&core=gav`;
    try {
      const response = await axios.get<{
        response: {
          docs: Array<{ v: string; timestamp?: number }>;
        };
      }>(url, { timeout: 10_000 });

      const doc = response.data.response?.docs?.[0];
      if (!doc) return null;

      return {
        name: packageName,
        latestVersion: doc.v,
        registryUrl: `https://search.maven.org/artifact/${groupId}/${artifactId}`,
        publishedAt: doc.timestamp
          ? new Date(doc.timestamp).toISOString()
          : undefined,
      };
    } catch {
      return null;
    }
  },
};
