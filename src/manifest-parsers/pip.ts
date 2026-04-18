import type { Dependency, ManifestParser } from "./types";
import * as yaml from "js-yaml";

export const pipParser: ManifestParser = {
  filePatterns: [
    "requirements.txt",
    "requirements/*.txt",
    "requirements-*.txt",
    "Pipfile",
    "pyproject.toml",
  ],

  parse(filePath: string, content: string): Dependency[] {
    if (filePath.endsWith("Pipfile")) return parsePipfile(content);
    if (filePath.endsWith("pyproject.toml")) return parsePyprojectToml(content);
    return parseRequirementsTxt(content);
  },
};

function parseRequirementsTxt(content: string): Dependency[] {
  const deps: Dependency[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line || line.startsWith("-")) continue;

    // name[extras]==version or name>=version etc.
    const match = line.match(/^([A-Za-z0-9_\-\.]+)(?:\[.*?\])?([=><~!].+)?$/);
    if (match) {
      deps.push({
        name: match[1].toLowerCase().replace(/_/g, "-"),
        currentVersion: match[2] ? cleanVersion(match[2]) : null,
        dependencyType: "production",
      });
    }
  }
  return deps;
}

function parsePipfile(content: string): Dependency[] {
  const deps: Dependency[] = [];
  let currentSection: "production" | "development" | null = null;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line === "[packages]") {
      currentSection = "production";
      continue;
    }
    if (line === "[dev-packages]") {
      currentSection = "development";
      continue;
    }
    if (line.startsWith("[")) {
      currentSection = null;
      continue;
    }
    if (!currentSection || !line || line.startsWith("#")) continue;

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;

    const name = line.slice(0, eqIdx).trim().replace(/["']/g, "");
    const rawVersion = line.slice(eqIdx + 1).trim().replace(/["']/g, "");
    deps.push({
      name,
      currentVersion: cleanVersion(rawVersion),
      dependencyType: currentSection,
    });
  }
  return deps;
}

function parsePyprojectToml(content: string): Dependency[] {
  const deps: Dependency[] = [];

  // Basic TOML-like extraction for dependencies arrays/tables
  // Handles PEP 621 style: dependencies = ["requests>=2.0"]
  const depArrayRegex = /^dependencies\s*=\s*\[([\s\S]*?)\]/m;
  const match = content.match(depArrayRegex);
  if (match) {
    const entries = match[1].match(/["']([^"']+)["']/g) ?? [];
    for (const entry of entries) {
      const cleaned = entry.replace(/["']/g, "").trim();
      const nameMatch = cleaned.match(
        /^([A-Za-z0-9_\-\.]+)(?:\[.*?\])?([=><~!].+)?$/
      );
      if (nameMatch) {
        deps.push({
          name: nameMatch[1].toLowerCase().replace(/_/g, "-"),
          currentVersion: nameMatch[2] ? cleanVersion(nameMatch[2]) : null,
          dependencyType: "production",
        });
      }
    }
  }

  return deps;
}

function cleanVersion(v: string): string | null {
  const cleaned = v.replace(/^[=><~!^*\s]+/, "").trim();
  return cleaned || null;
}
