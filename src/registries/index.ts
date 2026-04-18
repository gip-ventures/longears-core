import type { Ecosystem } from "../config/types";
import type { RegistryClient } from "./types";
import { npmRegistry } from "./npm";
import { pypiRegistry } from "./pypi";
import { rubygemsRegistry } from "./rubygems";
import { dockerRegistry } from "./docker";
import { createGithubActionsRegistry } from "./github-actions";
import { gomodRegistry } from "./gomod";
import { mavenRegistry } from "./maven";
import { composerRegistry } from "./composer";
import { nugetRegistry } from "./nuget";
import { pubRegistry } from "./pub";
import { mixRegistry } from "./mix";
import { createGitsubmoduleRegistry } from "./gitsubmodule";
import { devcontainersRegistry } from "./devcontainers";
import { dotnetSdkRegistry } from "./dotnet-sdk";

export function getRegistry(ecosystem: Ecosystem, githubToken = ""): RegistryClient {
  switch (ecosystem) {
    case "npm":
      return npmRegistry;
    case "pip":
      return pypiRegistry;
    case "bundler":
      return rubygemsRegistry;
    case "docker":
      return dockerRegistry;
    case "github-actions":
      return createGithubActionsRegistry(githubToken);
    case "gomod":
      return gomodRegistry;
    case "maven":
      return mavenRegistry;
    case "composer":
      return composerRegistry;
    case "nuget":
      return nugetRegistry;
    case "pub":
      return pubRegistry;
    case "mix":
      return mixRegistry;
    case "gitsubmodule":
      return createGitsubmoduleRegistry(githubToken);
    case "devcontainers":
      return devcontainersRegistry;
    case "dotnet-sdk":
      return dotnetSdkRegistry;
  }
}

export { RegistryClient, PackageMetadata } from "./types";
