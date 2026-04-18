import type { Dependency, ManifestParser } from "./types";

export const gomodParser: ManifestParser = {
  filePatterns: ["go.mod"],

  parse(_filePath: string, content: string): Dependency[] {
    const deps: Dependency[] = [];

    // Single-line require: require module version
    const singleRegex = /^require\s+(\S+)\s+(v[\d.]+\S*)/gm;
    let match: RegExpExecArray | null;
    while ((match = singleRegex.exec(content)) !== null) {
      deps.push({
        name: match[1],
        currentVersion: match[2],
        dependencyType: "production",
      });
    }

    // Block require: require ( ... )
    const blockRegex = /^require\s*\(([\s\S]*?)\)/gm;
    while ((match = blockRegex.exec(content)) !== null) {
      const block = match[1];
      const lineRegex = /^\s+(\S+)\s+(v[\d.]+\S*)/gm;
      let lineMatch: RegExpExecArray | null;
      while ((lineMatch = lineRegex.exec(block)) !== null) {
        const name = lineMatch[1];
        const version = lineMatch[2];
        // Skip indirect-only deps? Include them but mark accordingly.
        deps.push({
          name,
          currentVersion: version,
          dependencyType: "production",
        });
      }
    }

    return deps;
  },
};
