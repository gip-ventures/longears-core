import type { Dependency, ManifestParser } from "./types";

export const composerParser: ManifestParser = {
  filePatterns: ["composer.json"],

  parse(_filePath: string, content: string): Dependency[] {
    const deps: Dependency[] = [];

    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return [];
    }

    const addDeps = (
      obj: unknown,
      type: Dependency["dependencyType"]
    ): void => {
      if (!obj || typeof obj !== "object") return;
      for (const [name, version] of Object.entries(
        obj as Record<string, string>
      )) {
        if (name === "php" || name.startsWith("ext-")) continue;
        deps.push({
          name,
          currentVersion: cleanVersion(String(version)),
          dependencyType: type,
        });
      }
    };

    addDeps(pkg["require"], "production");
    addDeps(pkg["require-dev"], "development");

    return deps;
  },
};

function cleanVersion(v: string): string | null {
  const cleaned = v.replace(/^[^0-9v]*/, "").trim();
  return cleaned || null;
}
