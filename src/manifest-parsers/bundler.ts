import type { Dependency, ManifestParser } from "./types";

export const bundlerParser: ManifestParser = {
  filePatterns: ["Gemfile", "Gemfile.lock"],

  parse(filePath: string, content: string): Dependency[] {
    if (filePath.endsWith("Gemfile.lock")) {
      return parseGemfileLock(content);
    }
    return parseGemfile(content);
  },
};

function parseGemfile(content: string): Dependency[] {
  const deps: Dependency[] = [];
  // Match: gem "name" or gem 'name', optionally followed by version
  const gemRegex = /^\s*gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/gm;
  let match: RegExpExecArray | null;
  while ((match = gemRegex.exec(content)) !== null) {
    deps.push({
      name: match[1],
      currentVersion: match[2] ? cleanVersion(match[2]) : null,
      dependencyType: "production",
    });
  }
  return deps;
}

function parseGemfileLock(content: string): Dependency[] {
  const deps: Dependency[] = [];
  // In the GEM specs section: "    name (version)"
  const specsStart = content.indexOf("  specs:");
  if (specsStart === -1) return deps;

  const specsSection = content.slice(specsStart);
  const specRegex = /^    ([a-zA-Z0-9_\-\.]+) \(([^)]+)\)/gm;
  let match: RegExpExecArray | null;
  while ((match = specRegex.exec(specsSection)) !== null) {
    deps.push({
      name: match[1],
      currentVersion: match[2].split("-")[0].trim(),
      dependencyType: "production",
    });
  }
  return deps;
}

function cleanVersion(v: string): string | null {
  const cleaned = v.replace(/^[~><=!^*\s]+/, "").trim();
  return cleaned || null;
}
