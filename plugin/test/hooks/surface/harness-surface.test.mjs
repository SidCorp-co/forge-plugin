/* The shell reading reaches a gate the way the transcript reading does: through the harness and
   never past it, so a gate holds one import line for it rather than two (ISS-1841). What the harness
   passes on is what something takes from it, a test included, since a name on that surface is a
   claim about what a hook may use. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import * as harness from "../../../hooks/_hook.mjs";
import * as shellSpans from "../../../src/hooks/shell-spans.mjs";
import * as hereDoc from "../../../src/resolve/session/here-doc.mjs";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const GATES = join(ROOT, "plugin/hooks/gates");
const IMPORTERS = ["plugin", "packages", "tools"].map((one) => join(ROOT, one));

const filesUnder = (at) => readdirSync(at, { withFileTypes: true, recursive: true })
  .map((one) => join(one.parentPath ?? one.path, one.name))
  .filter((one) => one.endsWith(".mjs") && !one.includes("/node_modules/"));

/* A module named as what an import reads, static or dynamic, so a comment or a string that only
   mentions the path is no import of it. */
const SPECIFIER = (path) => String.raw`"[^"]*${path}"`;
const STATIC = (path) => String.raw`from\s*${SPECIFIER(path)}`;
const DYNAMIC = (path) => String.raw`await\s+import\(\s*${SPECIFIER(path)}`;
/* The shell reading is two modules: the words and spans, and where a here-document's body is. */
const SHELL_SPANS = String.raw`(?:hooks\/shell-spans|resolve\/session\/here-doc)\.mjs`;
const HARNESS = String.raw`\/_hook\.mjs`;
const reachesShellSpans = (text) => new RegExp(`${STATIC(SHELL_SPANS)}|${DYNAMIC(SHELL_SPANS)}`, "u").test(text);

const all = (text, pattern) => [...text.matchAll(new RegExp(pattern, "gu"))].map((one) => one[1]);

/* Every name a file takes from the harness: a named import or a destructured dynamic one by its own
   name rather than the one it is bound to, and a namespace, bound either way, by each member it
   reads off it. */
const takenFromHarness = (text) => {
  const picks = [
    ...all(text, String.raw`import\s*\{([^}]*)\}\s*${STATIC(HARNESS)}`),
    ...all(text, String.raw`\{([^}]*)\}\s*=\s*${DYNAMIC(HARNESS)}`),
  ].flatMap((list) => list.split(",").map((one) => one.trim().split(/\s+as\s+|\s*:\s*/u)[0]).filter(Boolean));
  const spaces = [
    ...all(text, String.raw`import\s*\*\s*as\s+(\w+)\s+${STATIC(HARNESS)}`),
    ...all(text, String.raw`\b(\w+)\s*=\s*${DYNAMIC(HARNESS)}`),
  ];
  return [...picks, ...spaces.flatMap((space) => all(text, String.raw`\b${space}\.(\w+)`))];
};

test("an import is read off what an import names, in every form this repository writes one", () => {
  assert.equal(reachesShellSpans('import { struck } from "../../src/hooks/shell-spans.mjs";'), true);
  assert.equal(reachesShellSpans('const { struck } = await import("../../src/hooks/shell-spans.mjs");'), true);
  assert.equal(reachesShellSpans("// a gate never imports hooks/shell-spans.mjs itself"), false, "a mention is no import");
  assert.equal(reachesShellSpans('import { withoutBodies } from "../../../src/resolve/session/here-doc.mjs";'), true,
    "the here-document reader is the shell reading too");
  assert.deepEqual(takenFromHarness('import {\n  NOWHERE,\n  spelled as bare,\n} from "../_hook.mjs";'), ["NOWHERE", "spelled"]);
  assert.deepEqual(takenFromHarness('const { DEADLINES, remaining: left } = await import("../../hooks/_hook.mjs");'),
    ["DEADLINES", "remaining"]);
  assert.deepEqual(takenFromHarness('const harness = await import("../../hooks/_hook.mjs");\nharness.struck("x");'), ["struck"]);
  assert.deepEqual(takenFromHarness('import * as harness from "../../hooks/_hook.mjs";\nharness.spans("x");'), ["spans"]);
});

test("a gate takes the shell reading through the harness and never the module itself", () => {
  const reaching = filesUnder(GATES).filter((one) => reachesShellSpans(readFileSync(one, "utf8")));
  assert.deepEqual(reaching, [], "a gate importing shell-spans directly splits the boundary the harness draws");
});

test("every name the harness passes on from the shell reading is one something takes from it", () => {
  const passed = Object.keys(harness).filter((name) => [shellSpans, hereDoc].some((one) => name in one && harness[name] === one[name]));
  const taken = new Set(IMPORTERS.flatMap(filesUnder).flatMap((one) => takenFromHarness(readFileSync(one, "utf8"))));
  assert.deepEqual(passed.filter((name) => !taken.has(name)), [],
    "a re-export nothing imports through the harness advertises a reading no hook uses: drop it from the export line");
});
