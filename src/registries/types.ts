export interface PackageMetadata {
  name: string;
  latestVersion: string;
  registryUrl: string;
  publishedAt?: string;
}

export interface RegistryClient {
  fetchMetadata(packageName: string, currentVersion?: string | null): Promise<PackageMetadata | null>;
}
