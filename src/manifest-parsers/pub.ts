import type { Dependency, ManifestParser } from "./types";
import * as yaml from "js-yaml";

export const pubParser: ManifestParser = {
  filePatterns: ["pubspec.yaml", "pubspec.yml"],

  parse(_filePath: string, content: string): Dependency[] {
    const deps: Dependency[] = [];

    let doc: unknown;
    try {
      doc = yaml.load(content);
    } catch {
      return [];
    }

    if (!doc || typeof doc !== "object") return [];
    const pubspec = doc as Record<string, unknown>;

    const addDeps = (
      obj: unknown,
      type: Dependency["dependencyType"]
    ): void => {
      if (!obj || typeof obj !== "object") return;
      for (const [name, constraint] of Object.entries(
        obj as Record<string, unknown>
      )) {
        if (name === "flutter" || name === "sdk") continue;
        let version: string | null = null;
        if (typeof constraint === "string") {
          version = cleanVersion(constraint);
        } else if (
          constraint &&
          typeof constraint === "object" &&
          "version" in constraint
        ) {
          version = cleanVersion(String((constraint as Record<string, unknown>)["version"]));
        }
        deps.push({ name, currentVersion: version, dependencyType: type });
      }
    };

    addDeps(pubspec["dependencies"], "production");
    addDeps(pubspec["dev_dependencies"], "development");

    return deps;
  },
};

function cleanVersion(v: string): string | null {
  const cleaned = v.replace(/^[^0-9]*/, "").trim();
  return cleaned || null;
}
