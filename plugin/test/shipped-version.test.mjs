/* The cache directory is keyed by plugin.json's version, so that number decides whether an installed
   session ever sees a commit — and `npm version` moves the other file. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const read = (...parts) => JSON.parse(readFileSync(join(ROOT, ...parts), "utf8")).version;

test("the version a session installs is the version this repository is at", () => {
  const shipped = read("plugin", ".claude-plugin", "plugin.json");
  const here = read("package.json");
  assert.equal(
    shipped,
    here,
    `plugin.json ships ${shipped} and package.json is at ${here}: \`claude plugin update\` would `
      + "report the plugin already current and install none of this",
  );
});
