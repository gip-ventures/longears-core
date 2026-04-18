import type { Dependency, ManifestParser } from "./types";

export const nugetParser: ManifestParser = {
  filePatterns: ["*.csproj", "*.fsproj", "*.vbproj", "packages.config", "Directory.Packages.props"],

  parse(filePath: string, content: string): Dependency[] {
    if (filePath.endsWith("packages.config")) {
      return parsePackagesConfig(content);
    }
    return parseCsproj(content);
  },
};

function parseCsproj(content: string): Dependency[] {
  const deps: Dependency[] = [];

  // <PackageReference Include="Name" Version="x.y.z" />
  const refRegex = /<PackageReference[^>]+Include=["']([^"']+)["'][^>]*(?:Version=["']([^"']+)["'])?[^>]*\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = refRegex.exec(content)) !== null) {
    let version: string | null = match[2] ?? null;
    if (!version) {
      // Version may be in a child element
      const afterTag = content.slice(match.index, match.index + 300);
      const childVersion = afterTag.match(/<Version>([^<]+)<\/Version>/);
      version = childVersion ? childVersion[1].trim() : null;
    }
    deps.push({
      name: match[1],
      currentVersion: version,
      dependencyType: "production",
    });
  }

  // <PackageVersion Include="Name" Version="x.y.z" /> (CPM style)
  const pvRegex = /<PackageVersion[^>]+Include=["']([^"']+)["'][^>]*Version=["']([^"']+)["'][^>]*\/?>/gi;
  while ((match = pvRegex.exec(content)) !== null) {
    deps.push({
      name: match[1],
      currentVersion: match[2],
      dependencyType: "production",
    });
  }

  return deps;
}

function parsePackagesConfig(content: string): Dependency[] {
  const deps: Dependency[] = [];
  const pkgRegex = /<package[^>]+id=["']([^"']+)["'][^>]*version=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = pkgRegex.exec(content)) !== null) {
    deps.push({
      name: match[1],
      currentVersion: match[2],
      dependencyType: "production",
    });
  }

  return deps;
}
