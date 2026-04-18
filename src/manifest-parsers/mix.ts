import type { Dependency, ManifestParser } from "./types";

export const mixParser: ManifestParser = {
  filePatterns: ["mix.exs"],

  parse(_filePath: string, content: string): Dependency[] {
    const deps: Dependency[] = [];

    // Match {:dep_name, "~> version"} or {:dep_name, "version"}
    // Also handles {:dep_name, git: "..."} — skip non-version deps
    const depRegex = /\{:([a-z_]+),\s*"([^"]+)"/g;
    let match: RegExpExecArray | null;

    while ((match = depRegex.exec(content)) !== null) {
      const name = match[1];
      const version = cleanVersion(match[2]);
      deps.push({
        name,
        currentVersion: version,
        dependencyType: "production",
      });
    }

    // Also handle tuple form: {:name, version, opts}
    const depWithOptsRegex =
      /\{:([a-z_]+),\s*"([^"]+)",\s*\[([^\]]+)\]\}/g;
    while ((match = depWithOptsRegex.exec(content)) !== null) {
      const opts = match[3];
      const isOnlyTest =
        opts.includes("only: :test") || opts.includes(":test");
      deps.push({
        name: match[1],
        currentVersion: cleanVersion(match[2]),
        dependencyType: isOnlyTest ? "development" : "production",
      });
    }

    return deps;
  },
};

function cleanVersion(v: string): string | null {
  const cleaned = v.replace(/^[~>= ]+/, "").trim();
  return cleaned || null;
}
