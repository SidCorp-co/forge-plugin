/* The shell reading reaches a gate the way the transcript reading does: through the harness and
   never past it, so a gate holds one import line for it rather than two (ISS-1841). What the harness
   passes on is what something takes from it, a test included, since a name on that surface is a
   claim about what a hook may use. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import * as harness from "../../hooks/_hook.mjs";
import * as shellSpans from "../../src/hooks/shell-spans.mjs";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const GATES = join(ROOT, "plugin/hooks/gates");
const IMPORTERS = ["plugin", "packages", "tools"].map((one) => join(ROOT, one));

const filesUnder = (at) => readdirSync(at, { withFileTypes: true, recursive: true })
  .map((one) => join(one.parentPath ?? one.path, one.name))
  .filter((one) => one.endsWith(".mjs") && !one.includes("/node_modules/"));

/* Every name a file takes from the harness: a named import by its own name rather than its alias,
   and a namespace import by each member it reads off the namespace. */
const takenFromHarness = (text) => {
  const named = [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*"[^"]*\/_hook\.mjs"/gu)]
    .flatMap((one) => one[1].split(",").map((name) => name.trim().split(/\s+as\s+/u)[0]).filter(Boolean));
  const spaces = [...text.matchAll(/import\s*\*\s*as\s+(\w+)\s+from\s*"[^"]*\/_hook\.mjs"/gu)].map((one) => one[1]);
  const members = spaces.flatMap((space) => [...text.matchAll(new RegExp(`\\b${space}\\.(\\w+)`, "gu"))].map((one) => one[1]));
  return [...named, ...members];
};

test("a gate takes the shell reading through the harness and never the module itself", () => {
  const reaching = filesUnder(GATES).filter((one) => readFileSync(one, "utf8").includes("hooks/shell-spans.mjs"));
  assert.deepEqual(reaching, [], "a gate importing shell-spans directly splits the boundary the harness draws");
});

test("every name the harness passes on from the shell reading is one something takes from it", () => {
  const passed = Object.keys(harness).filter((name) => name in shellSpans && harness[name] === shellSpans[name]);
  const taken = new Set(IMPORTERS.flatMap(filesUnder).flatMap((one) => takenFromHarness(readFileSync(one, "utf8"))));
  assert.deepEqual(passed.filter((name) => !taken.has(name)), [],
    "a re-export nothing imports through the harness advertises a reading no hook uses: drop it from the export line");
});
