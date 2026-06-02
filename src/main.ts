import * as path from "path";
import * as fs from "fs";
import * as core from "@actions/core";
import axios from "axios";

import { create as createGlobber } from "@actions/glob";
import { parseConfig } from "./config/parser";
import { isUpdateDue, resolveDirectories } from "./scheduler";
import { readTriggerContext, resolveTriggerEvent } from "./trigger";
import { getChangedFiles, matchChangedManifests } from "./changed-files";
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

  // Decide which trigger mode applies to this run.
  const triggerEvents = longearsConfig.trigger ?? ["schedule"];
  const triggerCtx = readTriggerContext();
  const triggerEvent = resolveTriggerEvent(triggerCtx);

  if (!triggerEvent || !triggerEvents.includes(triggerEvent)) {
    core.info(
      `Longears: event "${triggerCtx.eventName ?? "local"}" (resolved: ${triggerEvent ?? "unsupported"}) ` +
        `is not enabled in trigger config [${triggerEvents.join(", ")}]; nothing to do.`
    );
    const emptyReport = buildReport([]);
    writeReportFile(emptyReport, absoluteOutputFile);
    core.setOutput("results-path", absoluteOutputFile);
    return;
  }

  const changedFilesMode =
    triggerEvent === "pull_request" || triggerEvent === "push_default";
  let changedFiles: string[] = [];
  if (changedFilesMode) {
    changedFiles = await getChangedFiles(githubToken);
    core.info(
      `Longears: ${changedFiles.length} changed file(s) detected for ${triggerEvent}`
    );
  }

  for (const updateConfig of longearsConfig.updates) {
    const ecosystem = updateConfig["package-ecosystem"];
    const directories = resolveDirectories(updateConfig);
    const parser = getParser(ecosystem);

    // Gate: schedule mode uses the time-based schedule; changed-files mode runs
    // the whole ecosystem when any of its manifests changed (force overrides both).
    let triggeredByFiles: string[] = [];
    if (changedFilesMode && !force) {
      triggeredByFiles = matchChangedManifests(
        changedFiles,
        directories,
        parser.filePatterns
      );
      if (triggeredByFiles.length === 0) {
        core.info(`[${ecosystem}] Skipping — no changed manifest files`);
        continue;
      }
      core.info(`[${ecosystem}] Triggered by: ${triggeredByFiles.join(", ")}`);
    } else if (!changedFilesMode) {
      if (!isUpdateDue(updateConfig, longearsConfig, now, force)) {
        core.info(
          `[${ecosystem}] Skipping — not scheduled for ${now.toUTCString()}`
        );
        continue;
      }
    }

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
        core.debug(`[${ecosystem}] Globbing: ${absolutePattern}`);
        const globber = await createGlobber(absolutePattern, { followSymbolicLinks: false });
        const files = await globber.glob();
        core.debug(`[${ecosystem}] Matched ${files.length} file(s) for pattern "${pattern}"`);

        for (const filePath of files) {
          const content = fs.readFileSync(filePath, "utf8");
          const deps = parser.parse(filePath, content);
          core.debug(`[${ecosystem}] Parsed ${filePath}: ${deps.length} dep(s)`);
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

      const duplicateCount = allDeps.length - uniqueDeps.length;
      if (duplicateCount > 0) {
        core.debug(`[${ecosystem}] Removed ${duplicateCount} duplicate(s); ${uniqueDeps.length} unique`);
      }

      core.info(
        `[${ecosystem}] Found ${uniqueDeps.length} unique packages in ${directory}`
      );

      // Fetch registry metadata for each package
      const slottedResults: (PackageScanResult | null)[] = new Array(uniqueDeps.length).fill(null);
      let skipped = 0;

      await Promise.allSettled(
        uniqueDeps.map(async (dep, i) => {
          let metadata: PackageMetadata | null = null;
          try {
            metadata = await registry.fetchMetadata(dep.name, dep.currentVersion);
          } catch {
            // fetchMetadata already handles errors internally and returns null
          }

          if (!metadata) {
            core.debug(`[${ecosystem}] Skipped "${dep.name}" — registry returned null`);
            skipped++;
            return;
          }

          const updateAvailable =
            dep.currentVersion !== null &&
            dep.currentVersion !== metadata.latestVersion;

          slottedResults[i] = {
            name: dep.name,
            current_version: dep.currentVersion,
            latest_version: metadata.latestVersion,
            update_available: updateAvailable,
            dependency_type: dep.dependencyType,
            registry_url: metadata.registryUrl,
            published_at: metadata.publishedAt,
          };
        })
      );

      const packageResults = slottedResults.filter((r): r is PackageScanResult => r !== null);

      ecosystemResults.push({
        ecosystem,
        directory,
        scanned_at: now.toISOString(),
        packages: packageResults,
        ...(skipped > 0 ? { skipped_packages: skipped } : {}),
        ...(triggeredByFiles.length > 0
          ? { triggered_by_files: triggeredByFiles }
          : {}),
      });
    }
  }

  const report = buildReport(ecosystemResults);
  logReport(report);
  writeReportFile(report, absoluteOutputFile);

  core.setOutput("results-path", absoluteOutputFile);

  const apiKey = core.getInput("api-key");
  const apiEndpoint = core.getInput("api-endpoint");
  if (apiKey) {
    if (!apiEndpoint) {
      core.setFailed("api-key is set but api-endpoint is empty — provide the ingest URL");
      return;
    }
    core.info("Longears: delivering report to ingest API...");
    try {
      const response = await axios.post(apiEndpoint, report, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type":  "application/json",
        },
        timeout: 10_000,
        validateStatus: () => true,
      });
      if (response.status >= 200 && response.status < 300) {
        core.info(`Longears: report delivered — HTTP ${response.status}`);
      } else {
        core.setFailed(`Ingest API returned non-2xx status: ${response.status}`);
      }
    } catch (err) {
      core.setFailed(`Ingest API request failed: ${String(err)}`);
    }
  }
}

run().catch((err: unknown) => {
  core.setFailed(`Longears failed: ${String(err)}`);
});
