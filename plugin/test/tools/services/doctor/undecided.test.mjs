/* The reading that says what this project has not decided. The rows that report a value in force
   stay silent where a project decided nothing, which is right and is the other question (ISS-1974). */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { tempRoom } from "../../../fixtures.mjs";
import { PROJECT_KEYS } from "../../../../src/tools/services/project-file.mjs";
import { DECLARABLE } from "../../../../src/stats/corpus/declared.mjs";
import { RANK_ROWS, RANK_WEIGHTS } from "../../../../src/rank/weights.mjs";
import { briefUndecided, undecidedKeyRows } from "../../../../src/tools/services/doctor/undecided.mjs";

const CLI = new URL("../../../../src/cli.mjs", import.meta.url).pathname;

/* A home of its own and no credential, so no spawn below reaches a tracker, and a checkout of its
   own, so the project file under test is the one this walk finds first. */
const doctor = (project, ...argv) => {
  const home = tempRoom("doctor-undecided-home-");
  const at = tempRoom("doctor-undecided-cwd-");
  writeFileSync(join(at, ".forge.json"), JSON.stringify(project));
  const run = spawnSync(process.execPath, [CLI, "doctor", ...argv], {
    encoding: "utf8",
    cwd: at,
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  return `${run.stdout}${run.stderr}`;
};

const rowsIn = (said) => said.split("\n")
  .map((line) => /^\[(?<mark>[^\]]+)\] (?<label>\S+) +(?<detail>.+)$/u.exec(line)?.groups)
  .filter(Boolean);

const labelled = (said, label) => rowsIn(said).find((row) => row.label === label);

test("every writable path the project leaves unset prints with the call that sets it", () => {
  const said = doctor({ slug: "a-project" }, "undecided");
  assert.equal(labelled(said, "translate")?.detail,
    "not set — forge doctor --set translate=<text>", said);
  assert.equal(labelled(said, "runs")?.detail, "not set — forge doctor --set runs=<number>");
  assert.equal(labelled(said, "review.paths")?.detail,
    "not set — forge doctor --set review.paths=<one,two>");
  assert.equal(labelled(said, "deps.<name>")?.detail,
    "not set — forge doctor --set deps.<name>=<text>",
    "a path the project names for itself is spelled with the name it would type");
  for (const row of rowsIn(said)) {
    assert.equal(row.mark, "  ok  ", `${row.label} counts as a fault: ${row.detail}`);
  }
});

test("a key the project has already set prints no row", () => {
  const said = doctor({
    slug: "erp", translate: "vi", flow: "screen", rank: { kind: { bug: 30 } },
    feedback: { plugin: "all", project: "bugs" }, runs: 1, drainedBy: "qa-master",
  }, "undecided");
  for (const label of ["slug", "translate", "flow", "runs", "drainedBy",
    "rank.kind.bug", "feedback.plugin", "feedback.project"]) {
    assert.equal(labelled(said, label), undefined, `${label} is set here and this reading names it`);
  }
  assert.ok(labelled(said, "landing"), "while a key it did not set is still named");
});

test("the routed key names the call that writes it, and the retired key is named nowhere", () => {
  const said = doctor({ slug: "a-project" }, "undecided");
  assert.match(labelled(said, "flow")?.detail ?? "", /^not set — forge doctor --flow <slug>,/u,
    "flow is written by its own flag and the row spells that one");
  assert.equal(labelled(said, "method"), undefined,
    "and `method` is retired, so this reading may not offer it");
});

test("the labels a corpus reading declares print one row each, never a wildcard", () => {
  const said = doctor({ slug: "a-project" }, "undecided");
  for (const label of DECLARABLE) {
    assert.equal(labelled(said, `stats.commands.${label}`)?.detail,
      `not set — forge doctor --set stats.commands.${label}=<command>`);
  }
  assert.equal(labelled(said, "stats.commands.<name>"), undefined,
    "a closed set of labels is printed, not the wildcard the table spells it with");
});

test("a table whose row names are closed prints those rows, never a name the fold refuses", () => {
  const empty = doctor({ slug: "a-project" }, "undecided");
  assert.equal(labelled(empty, "rank.<name>"), undefined,
    "`rank.<name>` is a word foldWeights refuses, so offering it is a route to a refusal");
  assert.equal(labelled(empty, "rank.<name>.<name>"), undefined);
  for (const tail of [...RANK_WEIGHTS, ...RANK_ROWS]) {
    assert.equal(labelled(empty, `rank.${tail}`)?.detail,
      `not set — forge doctor --set rank.${tail}=<number>`);
  }
  const some = doctor({ slug: "a-project", rank: { blocks: 3 } }, "undecided");
  assert.equal(labelled(some, "rank.blocks"), undefined, "the weight it set");
  assert.ok(labelled(some, "rank.similarity"), "and every weight beside it that it did not");
  assert.ok(labelled(some, "rank.priority.high"));
});

test("a project that has stored no brief reads that from this same call", () => {
  const rows = briefUndecided({ entry: null });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, "project brief");
  assert.match(rows[0].detail, /^none stored — forge doctor --refresh <brief\.md>/u,
    "and the row carries the call that writes one");
  assert.deepEqual(briefUndecided({ entry: { body: "a brief" } }), [],
    "a project that stored one is told nothing here");
});

test("a brief the store would not answer for is no absence, and this reading says it is short", () => {
  const refused = { refused: "this credential may not read the store" };
  assert.deepEqual(briefUndecided(refused), [{ level: "miss",
    label: "project brief",
    detail: "unread, so whether one is stored was not read here — this credential may not read the store" }],
  "a reading that gave up on half of what it was asked for may not print nothing and exit green");
  assert.deepEqual(briefUndecided(refused, true), [],
    "while the brief's own reading, where it is in this one, carries that refusal itself");
});

test("a bare reading prints no row of this subject and names the call that prints it whole", () => {
  const said = doctor({ slug: "a-project" });
  assert.equal(labelled(said, "stats.commands.gate"), undefined,
    "what a project has not decided stays out of the reading that reports values in force");
  assert.match(said, /forge doctor undecided\s+the keys this project has not set/u,
    "and the call that prints it whole is named");
});

test("the keys this reading names are the registry's own, so one added appears and one removed leaves", () => {
  const rows = undecidedKeyRows({});
  const heads = [...new Set(rows.map((row) => row.label.split(".")[0]))].sort();
  const live = Object.keys(PROJECT_KEYS).filter((key) => !PROJECT_KEYS[key].retired).sort();
  assert.deepEqual(heads, live, "a key added to the table reaches this reading with no second edit");
  for (const head of heads) {
    assert.ok(Object.hasOwn(PROJECT_KEYS, head), `${head} is named here and the table holds no such key`);
  }
});
