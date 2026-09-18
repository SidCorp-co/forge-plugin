/* The reader that says what a blinding cause is actually worth. Three of these were written before
   this one, two of them wrong the same way — a row named after a cause read as a row named after a
   change — so what is asserted here is that a prediction re-derives reach and matches no string. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { tempRoom } from "../../../fixtures.mjs";

const CENSUS = fileURLToPath(new URL("../../../../../tools/gates/reads/census.mjs", import.meta.url));

const ONE = "plugin/test/one.test.mjs";
const TWO = "plugin/test/two.test.mjs";

const record = (root, file, { blind = [], spawned = [] }) => ({
  ticket: null, argv: [join(root, file)], paths: [file], dirs: [], trees: [],
  blind, spawned, done: true,
});

const room = (records) => {
  const at = tempRoom("gate-census-");
  const root = join(at, "checkout");
  const out = join(at, "records");
  mkdirSync(out, { recursive: true });
  records(root).forEach((one, index) => writeFileSync(join(out, `own-${index}.json`), JSON.stringify(one)));
  return { at, root, out };
};

const census = (where, rest = []) =>
  spawnSync(process.execPath, [CENSUS, where.out, "--root", where.root, ...rest], { encoding: "utf8" });

test("every cause of every blind file is named, with the kind each one is", () => {
  const where = room((root) => [
    record(root, ONE, {
      blind: ["cpSync: a tree copied whole"],
      spawned: [{ ticket: "gone", file: "git", cwd: root, args: ["grep", "-l"] }],
    }),
    record(root, TWO, {}),
  ]);
  try {
    const said = census(where);
    assert.equal(said.status, 0, said.stderr);
    assert.match(said.stdout, /2 test file\(s\) left a record; 1 blind/u);
    assert.match(said.stdout, /\| export \| `cpSync: a tree copied whole` \| 1 \|/u);
    assert.match(said.stdout, /\| child \| `git standing in the checkout` \| 1 \|/u);
    assert.match(said.stdout, /export: cpSync: a tree copied whole/u);
    assert.match(said.stdout, new RegExp(`^ {10}git grep -l in ${where.root}$`, "mu"),
      "the shape groups them, and the exact cause a ceiling is written against is under it");
    assert.doesNotMatch(said.stdout, new RegExp(TWO.replace(/\./gu, "\\."), "u"),
      "and a file nothing blinds is in the population and not in the causes");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* The count four filings in a row read as a prediction: a file two causes reach is in both rows, so
   the column sums past the population and removing either cause frees the file from neither. */
test("the overlap between the cause rows is stated rather than left to be summed", () => {
  const where = room((root) => [record(root, ONE, {
    blind: ["cpSync: a tree copied whole", "globSync: a listing by pattern"],
  })]);
  try {
    assert.match(census(where).stdout,
      /2 cause\(s\) and 2 file-and-shape pair\(s\) over 1 blind file\(s\), 1 of which carry more than one cause\. The files column sums past the population/u);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* The table groups on the shape and the file carries the causes, so the two counts are not one: a
   census claiming an overlap its own rows do not show is the reading this issue exists to stop. */
test("two commands of one program in one directory are two causes and one row", () => {
  const where = room((root) => [record(root, ONE, { spawned: [
    { ticket: "gone-1", file: "git", cwd: root, args: ["grep", "-l"] },
    { ticket: "gone-2", file: "git", cwd: root, args: ["status"] },
  ] })]);
  try {
    const said = census(where).stdout;
    assert.match(said, /2 cause\(s\) and 1 file-and-shape pair\(s\) over 1 blind file\(s\), 1 of which carry more than one cause\. No shape reaches a file another reaches/u);
    assert.match(said, /\| child \| `git standing in the checkout` \| 1 \|/u);
    assert.match(said, /child: git standing in the checkout ×2/u);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* The whole point of the script: a candidate is applied to the records and reach is derived again
   through the collector the gate runs, so a file a second cause still blinds is not counted freed. */
test("a candidate frees only the files whose every cause it removes, re-derived and not matched", () => {
  const where = room((root) => [
    record(root, ONE, { spawned: [{ ticket: "gone", file: "git", cwd: root, args: ["-C", "/elsewhere"] }] }),
    record(root, TWO, {
      blind: ["cpSync: a tree copied whole"],
      spawned: [{ ticket: "gone", file: "git", cwd: root, args: ["-C", "/elsewhere"] }],
    }),
  ]);
  const change = join(where.at, "change.mjs");
  writeFileSync(change, `export const record = (one) => ({ ...one, spawned: one.spawned.map((each) =>
    each.args?.[0] === "-C" ? { ...each, cwd: each.args[1] } : each) });\n`);
  try {
    const said = census(where, ["--change", change]);
    assert.equal(said.status, 0, said.stderr);
    assert.match(said.stdout, /\| before \| 2 \|/u);
    assert.match(said.stdout, /\| \*\*freed\*\* \| \*\*1\*\* \|/u);
    assert.match(said.stdout, new RegExp(`Freed, every one by name \\(1\\):\\n {2}0\\.0s ${ONE}`, "u"));
    assert.match(said.stdout, /Newly blind, which a candidate should not make \(0\):/u);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("the seconds a run measured are carried, so a row says what it costs as well as what it counts", () => {
  const where = room((root) => [record(root, ONE, { blind: ["cpSync: a tree copied whole"] })]);
  const times = join(where.at, "files");
  writeFileSync(times, `51.9s ${ONE}\n0.3s ${TWO}\n`);
  try {
    assert.match(census(where, ["--times", times]).stdout, /`cpSync: a tree copied whole` \| 1 \| 52s \|/u);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("the script says what it takes when it is asked, and refuses a candidate it cannot apply", () => {
  const help = spawnSync(process.execPath, [CENSUS, "-h"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: node tools\/gates\/reads\/census\.mjs <records-dir>/u);
  assert.match(help.stdout, /re-derived through the gate's own\n {20}reaches/u);
  assert.equal(spawnSync(process.execPath, [CENSUS], { encoding: "utf8" }).status, 1,
    "and named no records at all, it says so rather than reporting an empty run as a clean one");
  const flags = spawnSync(process.execPath, [CENSUS, "--root", "/tmp"], { encoding: "utf8" });
  assert.equal(flags.status, 1, "flags alone name no records either");
  assert.match(flags.stderr, /Name at least one directory of audit records/u);
  /* The collector answers an unreadable directory with no records, which the gate reads as a file
     spent; a census reading it that way would report a swept temp root as a run with nothing blind. */
  const gone = spawnSync(process.execPath, [CENSUS, "/no/such/records"], { encoding: "utf8" });
  assert.equal(gone.status, 1);
  assert.match(gone.stderr, /could not be read as a directory of audit records/u);
  const where = room((root) => [record(root, ONE, {})]);
  const empty = join(where.at, "nothing.mjs");
  writeFileSync(empty, "export const other = 1;\n");
  try {
    const said = census(where, ["--change", empty]);
    assert.equal(said.status, 1);
    assert.match(said.stderr, /exports no `record` function/u);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});
