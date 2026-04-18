import * as fs from "fs";
import * as yaml from "js-yaml";
import { z } from "zod";
import type { LongearsConfig } from "./types";

const scheduleSchema = z.object({
  interval: z.enum(["daily", "weekly", "monthly"]),
  day: z
    .enum([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ])
    .optional(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "time must be in HH:MM format")
    .optional(),
  timezone: z.string().optional(),
});

const groupConfigSchema = z.object({
  patterns: z.array(z.string()).optional(),
  "exclude-patterns": z.array(z.string()).optional(),
  "dependency-type": z.enum(["production", "development"]).optional(),
  "update-types": z
    .array(
      z.enum([
        "major",
        "minor",
        "patch",
        "version-update:semver-major",
        "version-update:semver-minor",
        "version-update:semver-patch",
      ])
    )
    .optional(),
});

const ignoreRuleSchema = z.object({
  "dependency-name": z.string(),
  versions: z.array(z.string()).optional(),
  "update-types": z
    .array(
      z.enum([
        "major",
        "minor",
        "patch",
        "version-update:semver-major",
        "version-update:semver-minor",
        "version-update:semver-patch",
      ])
    )
    .optional(),
});

const updateConfigSchema = z.object({
  "package-ecosystem": z.enum([
    "bundler",
    "composer",
    "devcontainers",
    "docker",
    "dotnet-sdk",
    "github-actions",
    "gitsubmodule",
    "gomod",
    "maven",
    "mix",
    "npm",
    "nuget",
    "pip",
    "pub",
  ]),
  directory: z.string().optional(),
  directories: z.array(z.string()).optional(),
  schedule: scheduleSchema.optional(),
  "multi-ecosystem-group": z.string().optional(),
  groups: z.record(groupConfigSchema).optional(),
  ignore: z.array(ignoreRuleSchema).optional(),
  patterns: z.array(z.string()).optional(),
});

const longearsConfigSchema = z.object({
  version: z.literal(2),
  "multi-ecosystem-groups": z
    .record(z.object({ schedule: scheduleSchema }))
    .optional(),
  updates: z.array(updateConfigSchema),
});

export function parseConfig(configPath: string): LongearsConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, "utf8");
  let parsed: unknown;

  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new Error(`Failed to parse YAML in ${configPath}: ${String(err)}`);
  }

  const result = longearsConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid longears config:\n${issues}`);
  }

  return result.data as LongearsConfig;
}
