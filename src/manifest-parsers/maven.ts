import type { Dependency, ManifestParser } from "./types";

export const mavenParser: ManifestParser = {
  filePatterns: ["pom.xml", "**/pom.xml"],

  parse(_filePath: string, content: string): Dependency[] {
    const deps: Dependency[] = [];

    // Extract <dependency> blocks from pom.xml
    const depBlockRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
    let blockMatch: RegExpExecArray | null;

    while ((blockMatch = depBlockRegex.exec(content)) !== null) {
      const block = blockMatch[1];

      const groupId = extractTag(block, "groupId");
      const artifactId = extractTag(block, "artifactId");
      const version = extractTag(block, "version");
      const scope = extractTag(block, "scope");

      if (!groupId || !artifactId) continue;

      const isDevScope = scope === "test" || scope === "provided";

      deps.push({
        name: `${groupId}:${artifactId}`,
        currentVersion: version,
        dependencyType: isDevScope ? "development" : "production",
      });
    }

    return deps;
  },
};

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]+)<\/${tag}>`));
  return match ? match[1].trim() : null;
}
