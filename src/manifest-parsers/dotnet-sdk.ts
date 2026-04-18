import type { Dependency, ManifestParser } from "./types";

export const dotnetSdkParser: ManifestParser = {
  filePatterns: ["global.json"],

  parse(_filePath: string, content: string): Dependency[] {
    let doc: unknown;
    try {
      doc = JSON.parse(content);
    } catch {
      return [];
    }

    if (!doc || typeof doc !== "object") return [];
    const cfg = doc as Record<string, unknown>;

    const sdk = cfg["sdk"] as Record<string, unknown> | undefined;
    if (!sdk || typeof sdk !== "object") return [];

    const version = typeof sdk["version"] === "string" ? sdk["version"] : null;

    return [
      {
        name: "dotnet-sdk",
        currentVersion: version,
        dependencyType: "production",
      },
    ];
  },
};
