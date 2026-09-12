/* R-20 against the real tree and the real source, because the gap it exists to catch was a whole
   provider nothing could see. The floors are the point: a selector that matches nothing reports a
   clean repository and reads exactly like one. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { claimedIn, reachedProblems, reachesOut } from "../../src/spec/claims/reached.mjs";

const ROOT = new URL("../../..", import.meta.url).pathname;
const TREE = "docs/requirements";
const SOURCE = "plugin/src";
const SECTION = `${TREE}/srs/19-external-interfaces.md`;
const CHATGPT = "plugin/src/tools/services/chatgpt.mjs";

const walk = (dir, ext, out = []) => {
  for (const name of readdirSync(join(ROOT, dir)).sort()) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, ext, out);
    else if (name.endsWith(ext)) out.push(rel);
  }
  return out;
};

const read = (file) => ({ file, text: readFileSync(join(ROOT, file), "utf8") });
const documents = walk(TREE, ".md").map(read);
const sources = walk(SOURCE, ".mjs").map(read);
const without = (value) => documents.map((one) =>
  (one.file === SECTION ? { ...one, text: one.text.replace(value, "") } : one));

test("every module of this repository that reaches an endpoint is named by an EI clause", () => {
  assert.ok(sources.length > 80, `${sources.length} module(s) under ${SOURCE}`);
  const reaching = sources.filter((one) => reachesOut(one.text));
  assert.ok(reaching.length >= 4, `${reaching.length} of them reach out; the selector sees too few`);
  assert.ok(reaching.some((one) => one.file === CHATGPT), "the chat backend's module among them");
  assert.ok(claimedIn(documents).size >= 4, "and the tree's EI clauses claim at least that many");
  const found = reachedProblems(documents, sources);
  assert.deepEqual(found, [], `a module reaches an endpoint no clause declares:\n${found.join("\n")}`);
});

/* Criterion 10's case: with the clause's claim on that module gone the finding is the only one, and
   a reader answering nothing fails this rather than passing quietly. */
test("a module no EI clause names is a finding carrying its path, the rule and the route out", () => {
  const claim = ` · Reached from: \`${CHATGPT}\``;
  const section = documents.find((one) => one.file === SECTION);
  assert.ok(section.text.includes(claim), `${SECTION} claims ${CHATGPT} on a field line`);
  const found = reachedProblems(without(claim), sources);
  assert.deepEqual(found.length, 1, found.join("\n"));
  assert.ok(found[0].startsWith(`${CHATGPT} R-20 `), found[0]);
  assert.ok(found[0].includes("reaches an endpoint outside this product and no EI clause names it"), found[0]);
  assert.ok(found[0].includes("docs/requirements/srs/19-external-interfaces.md"), found[0]);
  assert.ok(found[0].endsWith("carries this boundary"), found[0]);
});

test("the selector reads a call and an address, and neither a word ending in fetch nor prose", () => {
  assert.equal(reachesOut("const answer = await fetch(url);\n"), true);
  assert.equal(reachesOut('const BASE = "https://api.example.com/v4";\n'), true);
  assert.equal(reachesOut("const held = prefetch(one);\nconst all = one.refetch();\n"), false);
  assert.equal(reachesOut("/* the tracker is reached over its own API */\n"), false);
  assert.equal(reachesOut(""), false);
});

test("a claim is read off an EI field line only, and every code span on it counts", () => {
  const field = (id, value) => `### ${id} — A boundary\n\nRev: 1 · Reached from: ${value}\n\nWhat it is.\n`;
  assert.deepEqual([...claimedIn([{ file: "a.md", text: field("EI-01", "`src/a.mjs`, `src/b.mjs`") }])],
    ["src/a.mjs", "src/b.mjs"]);
  assert.deepEqual([...claimedIn([{ file: "a.md", text: field("FR-01", "`src/a.mjs`") }])], [],
    "a requirement's field line declares no interface");
  assert.deepEqual([...claimedIn([{ file: "a.md", text: "A paragraph naming `src/a.mjs`.\n" }])], [],
    "and prose naming a module claims nothing");
});
