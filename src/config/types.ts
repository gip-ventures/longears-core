export type Ecosystem =
  | "bundler"
  | "composer"
  | "devcontainers"
  | "docker"
  | "dotnet-sdk"
  | "github-actions"
  | "gitsubmodule"
  | "gomod"
  | "maven"
  | "mix"
  | "npm"
  | "nuget"
  | "pip"
  | "pub";

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type UpdateType =
  | "major"
  | "minor"
  | "patch"
  | "version-update:semver-major"
  | "version-update:semver-minor"
  | "version-update:semver-patch";

export type DependencyType = "production" | "development";

export interface Schedule {
  interval: "daily" | "weekly" | "monthly";
  day?: DayOfWeek;
  time?: string;
  timezone?: string;
}

export interface GroupConfig {
  patterns?: string[];
  "exclude-patterns"?: string[];
  "dependency-type"?: DependencyType;
  "update-types"?: UpdateType[];
}

export interface IgnoreRule {
  "dependency-name": string;
  versions?: string[];
  "update-types"?: UpdateType[];
}

export interface MultiEcosystemGroup {
  schedule: Schedule;
}

export interface UpdateConfig {
  "package-ecosystem": Ecosystem;
  directory?: string;
  directories?: string[];
  schedule?: Schedule;
  "multi-ecosystem-group"?: string;
  groups?: Record<string, GroupConfig>;
  ignore?: IgnoreRule[];
  patterns?: string[];
}

export interface LongearsConfig {
  version: 2;
  "multi-ecosystem-groups"?: Record<string, MultiEcosystemGroup>;
  updates: UpdateConfig[];
}
