import type { Dependency, ManifestParser } from "./types";

export const npmParser: ManifestParser = {
  filePatterns: ["package.json"],

  parse(_filePath: string, content: string): Dependency[] {
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return [];
    }

    const deps: Dependency[] = [];

    const addDeps = (
      obj: unknown,
      type: Dependency["dependencyType"]
    ): void => {
      if (!obj || typeof obj !== "object") return;
      for (const [name, version] of Object.entries(
        obj as Record<string, string>
      )) {
        deps.push({
          name,
          currentVersion: cleanVersion(String(version)),
          dependencyType: type,
        });
      }
    };

    addDeps(pkg["dependencies"], "production");
    addDeps(pkg["devDependencies"], "development");
    addDeps(pkg["peerDependencies"], "production");
    addDeps(pkg["optionalDependencies"], "production");

    return deps;
  },
};

function cleanVersion(v: string): string | null {
  // Strip semver range prefixes (^, ~, >=, etc.) to get a bare version
  const cleaned = v.replace(/^[^0-9]*/, "").split(/\s/)[0];
  return cleaned || null;
}
