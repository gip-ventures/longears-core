import type { Dependency, ManifestParser } from "./types";

export const gitsubmoduleParser: ManifestParser = {
  filePatterns: [".gitmodules"],

  parse(_filePath: string, content: string): Dependency[] {
    const deps: Dependency[] = [];

    // Parse .gitmodules ini-like format
    // [submodule "name"]
    //     path = path/to/sub
    //     url = https://github.com/owner/repo.git
    const submoduleRegex =
      /\[submodule\s+"([^"]+)"\]([\s\S]*?)(?=\[submodule|$)/g;
    let match: RegExpExecArray | null;

    while ((match = submoduleRegex.exec(content)) !== null) {
      const name = match[1];
      const block = match[2];

      const urlMatch = block.match(/url\s*=\s*(.+)/);
      const branchMatch = block.match(/branch\s*=\s*(.+)/);

      const url = urlMatch ? urlMatch[1].trim() : null;
      const branch = branchMatch ? branchMatch[1].trim() : null;

      // Use the URL as the "package name" so registries can resolve it
      deps.push({
        name: url ?? name,
        currentVersion: branch,
        dependencyType: "production",
      });
    }

    return deps;
  },
};
