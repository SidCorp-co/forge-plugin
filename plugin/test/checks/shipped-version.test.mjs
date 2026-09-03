/* The cache directory is keyed by plugin.json's version, so that number decides whether an installed
   session ever sees a commit — and `npm version` moves the other file. Every manifest git tracks, not
   the one that was noticed: the second sat seven minor versions behind its package. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const version = (path) => JSON.parse(readFileSync(path, "utf8")).version;

const manifests = () => {
  const git = spawnSync("git", ["-C", ROOT, "ls-files", "-z", "*.claude-plugin/plugin.json"], {
    encoding: "utf8",
  });
  assert.equal(git.status, 0, git.stderr);
  return git.stdout.split("\0").filter(Boolean).map((rel) => join(ROOT, rel));
};

/** The package.json the manifest ships beside: the nearest one at or above it. */
const packageFor = (manifest) => {
  let dir = dirname(manifest);
  while (dir.startsWith(ROOT)) {
    if (existsSync(join(dir, "package.json"))) return join(dir, "package.json");
    dir = dirname(dir);
  }
  return null;
};

test("every manifest ships the version its package is at", () => {
  const found = manifests();
  assert.ok(found.length >= 2, `${found.length} manifest(s) found; the selector matches nothing`);
  for (const manifest of found) {
    const pkg = packageFor(manifest);
    assert.ok(pkg, `${manifest.replace(ROOT, "")} has no package.json above it`);
    const shipped = version(manifest);
    const here = version(pkg);
    assert.equal(
      shipped,
      here,
      `${manifest.replace(ROOT, "")} ships ${shipped} and ${pkg.replace(ROOT, "")} is at ${here}: `
        + "`claude plugin update` would report it current and install none of this",
    );
  }
});
