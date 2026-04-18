import type { Dependency, ManifestParser } from "./types";

export const dockerParser: ManifestParser = {
  filePatterns: ["Dockerfile", "Dockerfile.*", "*.dockerfile", "docker-compose.yml", "docker-compose.yaml"],

  parse(filePath: string, content: string): Dependency[] {
    if (filePath.endsWith(".yml") || filePath.endsWith(".yaml")) {
      return parseDockerCompose(content);
    }
    return parseDockerfile(content);
  },
};

function parseDockerfile(content: string): Dependency[] {
  const deps: Dependency[] = [];

  // Match FROM directives: FROM image:tag [AS alias]
  const fromRegex = /^FROM\s+([^\s]+)/gim;
  let match: RegExpExecArray | null;

  while ((match = fromRegex.exec(content)) !== null) {
    const imageRef = match[1].trim();
    if (imageRef.toLowerCase() === "scratch") continue;

    const [imageName, tag] = splitImageRef(imageRef);
    deps.push({
      name: imageName,
      currentVersion: tag,
      dependencyType: "production",
    });
  }

  return deps;
}

function parseDockerCompose(content: string): Dependency[] {
  const deps: Dependency[] = [];
  // Match image: lines
  const imageRegex = /^\s+image:\s+["']?([^\s'"#]+)["']?/gm;
  let match: RegExpExecArray | null;

  while ((match = imageRegex.exec(content)) !== null) {
    const imageRef = match[1].trim();
    const [imageName, tag] = splitImageRef(imageRef);
    deps.push({
      name: imageName,
      currentVersion: tag,
      dependencyType: "production",
    });
  }

  return deps;
}

function splitImageRef(ref: string): [string, string | null] {
  // Strip digest (@sha256:...) before splitting on ':'
  const [withoutDigest] = ref.split("@");
  const colonIdx = withoutDigest.lastIndexOf(":");
  if (colonIdx === -1) return [withoutDigest, "latest"];
  return [withoutDigest.slice(0, colonIdx), withoutDigest.slice(colonIdx + 1)];
}
