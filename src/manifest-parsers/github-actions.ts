import type { Dependency, ManifestParser } from "./types";
import * as yaml from "js-yaml";

export const githubActionsParser: ManifestParser = {
  filePatterns: [".github/workflows/*.yml", ".github/workflows/*.yaml", ".github/actions/**/*.yml"],

  parse(_filePath: string, content: string): Dependency[] {
    const deps: Dependency[] = [];

    // Fast path: regex over raw text (avoids full YAML parse failures on complex workflows)
    const usesRegex = /uses:\s+["']?([^@\s'"]+)@([^\s'"#]+)/g;
    let match: RegExpExecArray | null;

    while ((match = usesRegex.exec(content)) !== null) {
      const actionRef = match[1].trim();
      const ref = match[2].trim();

      // Skip local actions (./, ../) — no registry to query
      if (actionRef.startsWith("./") || actionRef.startsWith("../")) continue;

      deps.push({
        name: actionRef,
        currentVersion: ref,
        dependencyType: "production",
      });
    }

    return deps;
  },
};
