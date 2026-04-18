import * as fs from "fs";
import * as path from "path";
import * as core from "@actions/core";

export interface PackageScanResult {
  name: string;
  current_version: string | null;
  latest_version: string;
  update_available: boolean;
  dependency_type: string;
  registry_url: string;
  published_at?: string;
}

export interface EcosystemScanResult {
  ecosystem: string;
  directory: string;
  scanned_at: string;
  packages: PackageScanResult[];
  skipped_packages?: number;
}

export interface ScanReport {
  version: 1;
  generated_at: string;
  results: EcosystemScanResult[];
}

export function buildReport(results: EcosystemScanResult[]): ScanReport {
  return {
    version: 1,
    generated_at: new Date().toISOString(),
    results,
  };
}

export function logReport(report: ScanReport): void {
  const total = report.results.reduce((n, r) => n + r.packages.length, 0);
  const updatable = report.results.reduce(
    (n, r) => n + r.packages.filter((p) => p.update_available).length,
    0
  );

  core.info(`\n=== Longears Scan Report ===`);
  core.info(`Generated: ${report.generated_at}`);
  core.info(`Ecosystems scanned: ${report.results.length}`);
  core.info(`Packages scanned: ${total}`);
  core.info(`Updates available: ${updatable}`);
  core.info("");

  for (const result of report.results) {
    const updateCount = result.packages.filter((p) => p.update_available).length;
    core.info(
      `[${result.ecosystem}] ${result.directory} — ${result.packages.length} packages, ${updateCount} updates available`
    );
    for (const pkg of result.packages.filter((p) => p.update_available)) {
      core.info(
        `  ⬆  ${pkg.name}: ${pkg.current_version ?? "unknown"} → ${pkg.latest_version}`
      );
    }
  }
}

export function writeReportFile(report: ScanReport, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  core.info(`\nScan results written to: ${outputPath}`);
}
