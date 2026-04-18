import type { Ecosystem } from "../config/types";
import type { ManifestParser } from "./types";
import { bundlerParser } from "./bundler";
import { composerParser } from "./composer";
import { devcontainersParser } from "./devcontainers";
import { dockerParser } from "./docker";
import { dotnetSdkParser } from "./dotnet-sdk";
import { githubActionsParser } from "./github-actions";
import { gitsubmoduleParser } from "./gitsubmodule";
import { gomodParser } from "./gomod";
import { mavenParser } from "./maven";
import { mixParser } from "./mix";
import { npmParser } from "./npm";
import { nugetParser } from "./nuget";
import { pipParser } from "./pip";
import { pubParser } from "./pub";

const PARSERS: Record<Ecosystem, ManifestParser> = {
  bundler: bundlerParser,
  composer: composerParser,
  devcontainers: devcontainersParser,
  docker: dockerParser,
  "dotnet-sdk": dotnetSdkParser,
  "github-actions": githubActionsParser,
  gitsubmodule: gitsubmoduleParser,
  gomod: gomodParser,
  maven: mavenParser,
  mix: mixParser,
  npm: npmParser,
  nuget: nugetParser,
  pip: pipParser,
  pub: pubParser,
};

export function getParser(ecosystem: Ecosystem): ManifestParser {
  return PARSERS[ecosystem];
}

export { ManifestParser };
