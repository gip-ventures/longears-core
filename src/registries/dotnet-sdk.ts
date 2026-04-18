import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

const RELEASES_INDEX_URL =
  "https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json";

export const dotnetSdkRegistry: RegistryClient = {
  async fetchMetadata(_packageName: string): Promise<PackageMetadata | null> {
    try {
      const response = await axios.get<{
        "releases-index": Array<{
          "latest-sdk": string;
          "release-date"?: string;
          "support-phase": string;
        }>;
      }>(RELEASES_INDEX_URL, { timeout: 10_000 });

      const channels = response.data["releases-index"] ?? [];
      // Pick the latest LTS or Current (non-EOL) SDK version
      const active = channels.filter(
        (c) => c["support-phase"] !== "eol"
      );
      const latest = active[0];
      if (!latest) return null;

      return {
        name: "dotnet-sdk",
        latestVersion: latest["latest-sdk"],
        registryUrl:
          "https://dotnet.microsoft.com/en-us/download/dotnet",
        publishedAt: latest["release-date"],
      };
    } catch {
      return null;
    }
  },
};
