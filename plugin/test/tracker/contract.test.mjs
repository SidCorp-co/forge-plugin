/* The contract is a document a verb serves, so its addresses are checked the way a route is: the
   parts are the file's own headings, and a heading renamed, dropped or added fails here rather than
   turning one command into a near miss for whoever reaches for it next. */
import assert from "node:assert/strict";
import test from "node:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { tempHome } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("contract").path;
const {
  CONTRACT,
  LISTING_ROW,
  contentsOf,
  contractAnswer,
  contractPath,
  contractProblems,
  keysOfAll,
  partFor,
  partsOf,
  readContract,
  stageLine,
  statesContract,
} = await import("../../src/tracker/contract.mjs");
const { ORDER } = await import("../../src/flow/earned.mjs");

const ROOT = new URL("../../../", import.meta.url).pathname;
const PLUGIN = join(ROOT, "plugin");
const TEXT = readContract();
const PARTS = partsOf(TEXT);
const STAGED = [...ORDER, "dropped"];

test("the contract is inside the plugin, at one path, and nothing else in the tree holds it", () => {
  assert.equal(contractPath(), join(PLUGIN, "guides", "issue-flow-contract.md"));
  assert.ok(existsSync(contractPath()), `${contractPath()} is what every route now names`);
  const tracked = execFileSync("git", ["-C", ROOT, "ls-files", "*.md"], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean);
  const holding = tracked.filter((rel) =>
    readFileSync(join(ROOT, rel), "utf8").includes("## The stages, scenario by scenario"));
  assert.deepEqual(holding, ["plugin/guides/issue-flow-contract.md"], "one source, and docs/ points at it");
});

test("every status of the flow has a part, and the sections are the file's own headings", () => {
  for (const status of STAGED) {
    assert.ok(partFor(PARTS, status), `no part of the contract states the ${status} stage`);
  }
  assert.deepEqual(keysOfAll(PARTS), [
    "the-issue-flow-contract", "the-constraint", "two-layers-one-record", "the-flow",
    "the-stages-scenario-by-scenario", ...STAGED.slice(0, 9), "dropped", "when-the-run-breaks",
    "breaks-mid-run", "findings-mid-development", "the-mechanics", "what-it-does-not-do",
    "open-questions", "where-the-rules-came-from",
  ], "a heading renamed, dropped or added moves the command that reaches it, and says so here");
  const keys = keysOfAll(PARTS);
  assert.equal(new Set(keys).size, keys.length, "two parts under one key would serve whichever came first");
});

test("the parts partition the whole, so nothing is served twice and nothing is unreachable", () => {
  const rejoined = PARTS.map((part) => part.text).join("\n");
  const flat = (text) => text.replace(/\s+/gu, " ").trim();
  assert.equal(flat(rejoined), flat(TEXT));
  assert.ok(PARTS.every((part) => part.chars > 100), "a part with no body is a heading nobody wrote under");
});

/* The derivation, on headings this file does not have: the rule is a heading's words up to the em
   dash, and the statuses of a part are the code spans in that half. */
test("a heading becomes its own address, and a heading of statuses becomes one part per status", () => {
  const made = partsOf("# A Title — with a tail\n\nx\n\n### `alpha`, `beta` — reads two things\n\ny\n");
  assert.deepEqual(made.map((part) => part.keys), [["a-title"], ["alpha", "beta"]]);
  assert.equal(made[1].said, "reads two things");
  assert.deepEqual(partsOf("## Two\n\na\n\n#### Deeper still\n\nb\n").map((part) => part.keys),
    [["two"], ["deeper-still"]], "every heading level is an address, so none of the text is unreachable");
  assert.deepEqual(partsOf("## Two layers, one record\n\nz\n")[0].keys, ["two-layers-one-record"]);
});

test("a separator misremembered costs no round", () => {
  assert.equal(partFor(PARTS, "in-progress"), partFor(PARTS, "in_progress"));
  assert.equal(partFor(PARTS, "mechanics"), null, "and only a separator or a case is forgiven");
});

test("the table of contents is one line per part and per status, and none of the prose", () => {
  const lines = contentsOf(PARTS, statesContract(TEXT));
  const rows = lines.slice(3);
  assert.equal(rows.length, keysOfAll(PARTS).length);
  for (const row of rows) assert.match(row, /^ {2}\S+ +\d+ {2}forge guide contract \S+$/u);
  assert.match(lines[0], new RegExp(`contract ${CONTRACT}`, "u"));
  assert.equal(lines.join("\n").includes("A status is a promise"), false, "no sentence of the contract");
  assert.match(LISTING_ROW, /^contract\n {2}this plugin's own, not the tracker's/u);
});

test("the number the file states is its own line, and the prose about versions is not it", () => {
  assert.equal(statesContract(TEXT), CONTRACT);
  assert.equal(statesContract("Every typed write carries the contract version it was written under."), null);
  assert.equal(statesContract("**Contract 4.** and then some prose"), 4);
});

test("a copy with no contract, one with no number and one from another build are each a finding", () => {
  const path = "/somewhere/guides/issue-flow-contract.md";
  assert.deepEqual(contractProblems({ text: TEXT, path }), []);
  assert.match(contractProblems({ text: null, path })[0], /no contract at \/somewhere\//u);
  assert.match(contractProblems({ text: "# No number here", path })[0], /states no contract number/u);
  assert.match(
    contractProblems({ text: "**Contract 9.**", path })[0],
    new RegExp(`states contract 9 and this build reads contract ${CONTRACT}`, "u"),
  );
  assert.match(
    contractProblems({ text: TEXT, path, reads: CONTRACT + 1 })[0],
    new RegExp(`states contract ${CONTRACT} and this build reads contract ${CONTRACT + 1}`, "u"),
    "an older file under a newer build is the same finding: the number is matched, never ranged",
  );
});

test("the stage line names the part for the status and the command that prints it", () => {
  for (const status of STAGED) {
    const said = stageLine(status, PARTS);
    assert.match(said, new RegExp(`the ${status} stage`, "u"), status);
    assert.match(said, new RegExp(`\`forge guide contract ${status}\``, "u"), status);
    assert.match(said, /\(\d+ characters\)/u, status);
  }
  assert.match(
    stageLine("needs_info", PARTS),
    /No needs_info stage in the contract at \S+ — `forge doctor`/u,
    "a status no part covers is said out loud, never left silent",
  );
  assert.match(
    stageLine("confirmed", partsOf(null), "/gone/issue-flow-contract.md"),
    /No confirmed stage in the contract at \/gone\/issue-flow-contract\.md/u,
    "and a copy that arrived without the file reads the same way, which `forge doctor` tells apart",
  );
});

test("the verb's answer is one part, the contents, or one refusal that names the way out", () => {
  assert.deepEqual(contractAnswer({ part: "released" }).lines, [partFor(PARTS, "released").text]);
  assert.equal(contractAnswer({}).lines[0].startsWith("The issue-flow contract"), true);
  assert.match(contractAnswer({ tracker: true }).refusal, /the contract is this plugin's/u);
  assert.match(contractAnswer({ part: "open", extra: ["more"] }).refusal, /takes one part/u);
  assert.match(contractAnswer({ part: "mechanics" }).refusal, /Did you mean: the-mechanics\?/u);
  assert.match(contractAnswer({ part: "nothing-like-it" }).refusal, /lists every part/u);
});

/* A copy of the code with no guides/ beside it is what every installed copy was before ISS-78, and
   the only way to watch the report say so is to make one. */
const copyOfCode = (contract) => {
  const room = mkdtempSync(join(tmpdir(), "contract-copy-"));
  for (const held of ["src", "hooks"]) {
    cpSync(join(PLUGIN, held), join(room, held), { recursive: true });
  }
  if (contract !== null) {
    mkdirSync(join(room, "guides"));
    writeFileSync(join(room, "guides", "issue-flow-contract.md"), contract);
  }
  const home = mkdtempSync(join(tmpdir(), "contract-home-"));
  const run = spawnSync(process.execPath, [join(room, "src", "cli.mjs"), "doctor"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  return `${run.stdout}${run.stderr}`;
};

test("doctor names the missing file, and a file from another build, in the copy that is running", () => {
  assert.match(copyOfCode(null), /\[ miss \] contract\s+no contract at \S+guides\/issue-flow-contract\.md/u);
  assert.match(copyOfCode("**Contract 9.**\n"), /\[ miss \] contract\s+\S+ states contract 9/u);
  assert.match(copyOfCode(TEXT), /\[ {2}ok {2}\] contract\s+\S+ states contract 1/u);
});
