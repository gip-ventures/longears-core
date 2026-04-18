import type { PackageMetadata, RegistryClient } from "./types";
import { dockerRegistry } from "./docker";

// Devcontainers reference OCI images (Docker Hub or GHCR).
// Delegate to the docker registry client.
export const devcontainersRegistry: RegistryClient = {
  async fetchMetadata(packageName: string): Promise<PackageMetadata | null> {
    return dockerRegistry.fetchMetadata(packageName);
  },
};
