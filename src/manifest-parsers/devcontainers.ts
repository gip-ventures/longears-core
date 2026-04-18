import type { Dependency, ManifestParser } from "./types";

export const devcontainersParser: ManifestParser = {
  filePatterns: [
    ".devcontainer/devcontainer.json",
    ".devcontainer.json",
    ".devcontainer/**/devcontainer.json",
  ],

  parse(_filePath: string, content: string): Dependency[] {
    const deps: Dependency[] = [];

    // Strip JSON comments (devcontainer.json allows them)
    const stripped = content.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

    let doc: unknown;
    try {
      doc = JSON.parse(stripped);
    } catch {
      return [];
    }

    if (!doc || typeof doc !== "object") return [];
    const cfg = doc as Record<string, unknown>;

    // Base image reference
    const image = cfg["image"];
    if (typeof image === "string") {
      const [imageName, tag] = splitImageRef(image);
      deps.push({
        name: imageName,
        currentVersion: tag,
        dependencyType: "production",
      });
    }

    // Features: { "ghcr.io/devcontainers/features/node:1": {} }
    const features = cfg["features"];
    if (features && typeof features === "object") {
      for (const [featureRef] of Object.entries(
        features as Record<string, unknown>
      )) {
        const [name, tag] = splitImageRef(featureRef);
        deps.push({
          name,
          currentVersion: tag,
          dependencyType: "production",
        });
      }
    }

    return deps;
  },
};

function splitImageRef(ref: string): [string, string | null] {
  const [withoutDigest] = ref.split("@");
  const colonIdx = withoutDigest.lastIndexOf(":");
  if (colonIdx === -1) return [withoutDigest, null];
  return [withoutDigest.slice(0, colonIdx), withoutDigest.slice(colonIdx + 1)];
}
