import axios from "axios";
import type { PackageMetadata, RegistryClient } from "./types";

const PROXY_URL = "https://proxy.golang.org";

export const gomodRegistry: RegistryClient = {
  async fetchMetadata(moduleName: string): Promise<PackageMetadata | null> {
    const encodedModule = moduleName.toLowerCase().replace(/([A-Z])/g, (c) => `!${c.toLowerCase()}`);
    const url = `${PROXY_URL}/${encodedModule}/@latest`;
    try {
      const response = await axios.get<{ Version: string; Time?: string }>(
        url,
        { timeout: 10_000 }
      );

      const latestVersion = response.data.Version;
      if (!latestVersion) return null;

      return {
        name: moduleName,
        latestVersion,
        registryUrl: `https://pkg.go.dev/${moduleName}`,
        publishedAt: response.data.Time,
      };
    } catch {
      return null;
    }
  },
};
