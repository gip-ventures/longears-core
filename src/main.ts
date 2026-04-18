import * as path from "path";
import * as fs from "fs";
import * as core from "@actions/core";
import { create as createGlobber } from "@actions/glob";
import { parseConfig } from "./config/parser";
import { isUpdateDue, resolveDirectories } from "./scheduler";
import { getParser } from "./manifest-parsers/index";
import { getRegistry } from "./registries/index";
import type { Dependency } from "./manifest-parsers/types";
import type { PackageMetadata } from "./registries/types";
import type { EcosystemScanResult, PackageScanResult } from "./metadata-logger";
import {
  buildReport,
  logReport,
  writeReportFile,
} from "./metadata-logger";

async function run(): Promise<void> {
  const configPath = core.getInput("config-path") || ".github/longears.yml";
  const workspaceDir = core.getInput("workspace-dir") || process.cwd();
  const force = core.getInput("force") === "true";
  const githubToken = core.getInput("github-token") || "";
  const outputFile = core.getInput("output-file") || "longears-results.json";

  const absoluteConfigPath = path.isAbsolute(configPath)
    ? configPath
    : path.join(workspaceDir, configPath);
  const absoluteOutputFile = path.isAbsolute(outputFile)
    ? outputFile
    : path.join(workspaceDir, outputFile);

  core.info(`Longears: reading config from ${absoluteConfigPath}`);

  let longearsConfig;
  try {
    longearsConfig = parseConfig(absoluteConfigPath);
  } catch (err) {
    core.setFailed(`Config error: ${String(err)}`);
    return;
  }

  const now = new Date();
  const ecosystemResults: EcosystemScanResult[] = [];

  for (const updateConfig of longearsConfig.updates) {
    const ecosystem = updateConfig["package-ecosystem"];

    if (!isUpdateDue(updateConfig, longearsConfig, now, force)) {
      core.info(
        `[${ecosystem}] Skipping — not scheduled for ${now.toUTCString()}`
      );
      continue;
    }

    const directories = resolveDirectories(updateConfig);
    const parser = getParser(ecosystem);
    const registry = getRegistry(ecosystem, githubToken);

    for (const directory of directories) {
      core.info(`[${ecosystem}] Scanning ${directory}...`);

      // Resolve to absolute path
      const absoluteDir = path.join(
        workspaceDir,
        directory.startsWith("/") ? directory.slice(1) : directory
      );

      if (!fs.existsSync(absoluteDir)) {
        core.warning(`[${ecosystem}] Directory not found: ${absoluteDir}`);
        continue;
      }

      // Find manifest files using glob patterns
      const allDeps: Dependency[] = [];
      for (const pattern of parser.filePatterns) {
        const absolutePattern = path.join(absoluteDir, pattern);
        const globber = await createGlobber(absolutePattern, { followSymbolicLinks: false });
        const files = await globber.glob();

        for (const filePath of files) {
          const content = fs.readFileSync(filePath, "utf8");
          const deps = parser.parse(filePath, content);
          allDeps.push(...deps);
        }
      }

      // Deduplicate by package name (keep first occurrence)
      const seen = new Set<string>();
      const uniqueDeps = allDeps.filter((d) => {
        if (seen.has(d.name)) return false;
        seen.add(d.name);
        return true;
      });

      core.info(
        `[${ecosystem}] Found ${uniqueDeps.length} unique packages in ${directory}`
      );

      // Fetch registry metadata for each package
      const packageResults: PackageScanResult[] = [];
      let skipped = 0;

      await Promise.allSettled(
        uniqueDeps.map(async (dep) => {
          let metadata: PackageMetadata | null = null;
          try {
            metadata = await registry.fetchMetadata(dep.name, dep.currentVersion);
          } catch {
            // fetchMetadata already handles errors internally and returns null
          }

          if (!metadata) {
            skipped++;
            return;
          }

          const updateAvailable =
            dep.currentVersion !== null &&
            dep.currentVersion !== metadata.latestVersion;

          packageResults.push({
            name: dep.name,
            current_version: dep.currentVersion,
            latest_version: metadata.latestVersion,
            update_available: updateAvailable,
            dependency_type: dep.dependencyType,
            registry_url: metadata.registryUrl,
            published_at: metadata.publishedAt,
          });
        })
      );

      ecosystemResults.push({
        ecosystem,
        directory,
        scanned_at: now.toISOString(),
        packages: packageResults,
        skipped_packages: skipped,
      });
    }
  }

  const report = buildReport(ecosystemResults);
  logReport(report);
  writeReportFile(report, absoluteOutputFile);

  core.setOutput("results-path", absoluteOutputFile);
}

run().catch((err: unknown) => {
  core.setFailed(`Longears failed: ${String(err)}`);
});
