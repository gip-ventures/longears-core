export type DependencyType = "production" | "development" | "unknown";

export interface Dependency {
  name: string;
  currentVersion: string | null;
  dependencyType: DependencyType;
}

export interface ManifestParser {
  /** Glob patterns relative to the scanned directory that identify manifest files */
  filePatterns: string[];
  /** Parse a manifest file and return the list of dependencies it declares */
  parse(filePath: string, content: string): Dependency[];
}
