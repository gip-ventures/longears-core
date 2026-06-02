import { getChangedFiles, matchChangedManifests } from "../changed-files";

describe("matchChangedManifests", () => {
  it("matches a changed file against a root-level pattern", () => {
    const changed = ["package.json", "README.md"];
    expect(matchChangedManifests(changed, ["/"], ["package.json"])).toEqual([
      "package.json",
    ]);
  });

  it("does not match a root pattern against a nested file", () => {
    const changed = ["sub/package.json"];
    expect(matchChangedManifests(changed, ["/"], ["package.json"])).toEqual([]);
  });

  it("matches nested manifests via globstar patterns", () => {
    const changed = ["sub/pom.xml", "deep/nested/pom.xml"];
    expect(matchChangedManifests(changed, ["/"], ["**/pom.xml"])).toEqual([
      "sub/pom.xml",
      "deep/nested/pom.xml",
    ]);
  });

  it("matches dotted workflow paths", () => {
    const changed = [".github/workflows/ci.yml", "src/index.ts"];
    expect(
      matchChangedManifests(changed, ["/"], [".github/workflows/*.yml"])
    ).toEqual([".github/workflows/ci.yml"]);
  });

  it("returns empty when no changed file matches a manifest pattern", () => {
    const changed = ["README.md", "docs/guide.md"];
    expect(matchChangedManifests(changed, ["/"], ["package.json"])).toEqual([]);
  });

  it("respects a configured subdirectory scope", () => {
    const changed = ["sub/pom.xml", "other/pom.xml"];
    expect(matchChangedManifests(changed, ["/sub"], ["pom.xml"])).toEqual([
      "sub/pom.xml",
    ]);
  });

  it("does not double-report a file matched in multiple directories", () => {
    const changed = ["package.json"];
    expect(
      matchChangedManifests(changed, ["/", "/"], ["package.json"])
    ).toEqual(["package.json"]);
  });
});

describe("getChangedFiles", () => {
  it("returns [] when not running inside a GitHub event context", async () => {
    const prevEventPath = process.env.GITHUB_EVENT_PATH;
    const prevRepo = process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_EVENT_PATH;
    delete process.env.GITHUB_REPOSITORY;
    try {
      await expect(getChangedFiles("token")).resolves.toEqual([]);
    } finally {
      if (prevEventPath !== undefined) process.env.GITHUB_EVENT_PATH = prevEventPath;
      if (prevRepo !== undefined) process.env.GITHUB_REPOSITORY = prevRepo;
    }
  });
});
