/* A test file the audit could not follow to the end records nothing, so nothing can ever say it is
   unaffected and the gate spends it on every change — what that costs this suite is a figure the
   gate's own help states. These are the rules a declared ceiling stands on (ISS-1761). */
import assert from "node:assert/strict";
import test from "node:test";
import { rmSync } from "node:fs";
import { join } from "node:path";

import { claimsJudged, contextOf, declaredSet, forgetReads, recordSets, selectTests }
  from "../../../../../tools/gates/reads/sets.mjs";
import { declarationFor } from "../../../../../tools/gates/steps.mjs";
import { deadClaim, escapedClaim, readsSaid, severalCauses, wroteSets }
  from "../../../../../tools/gates/report/said.mjs";
import { declaredReads, landed, ROOT, run, scratch, write } from "../scratch.mjs";
import { tempRoom } from "../../../fixtures.mjs";

const FILE = "plugin/test/one.test.mjs";
const BLIND = "git in the checkout";
const CAUSE = { kind: "child", why: BLIND };

const declaring = (reads) => [{ where: FILE, reads, blind: BLIND }];

const CONTEXT = contextOf(["--test"], "", declaring(["plugin/src"]));

const room = (files = {}) => {
  const at = tempRoom("gate-declared-");
  const root = join(at, "checkout");
  for (const [path, text] of Object.entries({ [FILE]: "the test\n", ...files })) write(root, path, text);
  return { at, root, dir: join(at, "records") };
};

const setOf = (paths, dirs = [], trees = [], whole = []) =>
  ({ file: FILE, paths: new Set(paths), dirs: new Set(dirs), trees: new Set(trees),
    whole: new Set(whole), blind: [] });

/* A blind set and a table in one call, so a case says only which claims it is about. The tracked
   list is what a directory claim expands over, and the gate hands it git's own. */
const declared = ({ root, dir }, set, table, tracked) => {
  forgetReads();
  const judged = claimsJudged([set], { manifests: [], declared: table });
  const said = recordSets(dir, [set],
    { root, context: CONTEXT, manifests: [], tracked, declared: table, escaped: judged.escaped });
  forgetReads();
  return { ...judged, ...said, ...selectTests(dir, [FILE], { root, context: CONTEXT }) };
};

const again = ({ root, dir }, context = CONTEXT) => {
  forgetReads();
  return selectTests(dir, [FILE], { root, context });
};

/* The whole point: the reads were computed and thrown away, so a file nothing can ever say is
   unaffected was spent on every change (ISS-1761). */
test("a blind file a declaration covers is recorded and held back at that same content", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    const set = { ...setOf(["plugin/src/one.mjs"]), blind: [CAUSE] };
    const said = declared(where, set, declaring(["plugin/src"]), ["plugin/src/one.mjs", FILE]);
    assert.deepEqual(said.escaped, [], "nothing observed escaped the claim");
    assert.deepEqual(said.declared, [FILE]);
    assert.deepEqual(said.spend, []);
    assert.equal(said.kept[0].set.declared, BLIND, "the entry carries the blindness it was declared under");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a path the audit saw that no claim covers fails, names what escaped, and writes no entry", () => {
  const where = room({ "plugin/src/one.mjs": "one\n", "docs/two.md": "two\n" });
  try {
    const set = { ...setOf(["plugin/src/one.mjs", "docs/two.md"]), blind: [CAUSE] };
    const said = declared(where, set, declaring(["plugin/src"]), ["plugin/src/one.mjs", "docs/two.md", FILE]);
    assert.equal(said.wrote, 0, "the entry a wrong ceiling would have banked");
    assert.deepEqual(said.spend, [FILE]);
    assert.equal(said.escaped.length, 1);
    assert.deepEqual(said.escaped[0].escapes, [{ kind: "path", one: "docs/two.md" }]);
    assert.deepEqual(said.escaped[0].claims, ["plugin/src"]);
    assert.equal(said.escaped[0].file, FILE);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a listing and a walk the claims do not cover escape as well, each said as what it was", () => {
  const where = room({ "plugin/src/one.mjs": "one\n", "docs/two.md": "two\n" });
  try {
    const set = { ...setOf([], ["docs"], ["packages"]), blind: [CAUSE] };
    const said = declared(where, set, declaring(["plugin/src"]), [FILE]);
    assert.deepEqual(said.escaped[0].escapes.map((one) => one.kind).sort(), ["listing", "walk"]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* A declared claim is a ceiling and the entry is bounded by it, so a path inside it moving has to
   spend the file even where the audit never saw that path: the unfollowable child may have. */
test("a change to a tracked file inside a directory claim spends the file, and one outside it does not", () => {
  const where = room({ "plugin/src/one.mjs": "one\n", "plugin/src/two.mjs": "two\n", "docs/two.md": "two\n" });
  const tracked = ["docs/two.md", "plugin/src/one.mjs", "plugin/src/two.mjs", FILE];
  try {
    const set = { ...setOf(["plugin/src/one.mjs"]), blind: [CAUSE] };
    assert.deepEqual(declared(where, set, declaring(["plugin/src"]), tracked).spend, []);
    write(where.root, "plugin/src/two.mjs", "two, moved\n");
    assert.deepEqual(again(where).spend, [FILE], "a claimed path the audit never saw");
    write(where.root, "plugin/src/two.mjs", "two\n");
    write(where.root, "docs/two.md", "two, moved\n");
    assert.deepEqual(again(where).spend, [], "a path no claim covers");
    write(where.root, "plugin/src/three.mjs", "three\n");
    assert.deepEqual(again(where).spend, [FILE], "a path appearing under the claim, which git tracks nothing at yet");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* The expansion reaches only what git tracks, so an observed path it cannot price would otherwise
   be authorised by containment and digested by nothing. */
test("a path the audit saw under a claim that git does not track keeps its own content in the entry", () => {
  const where = room({ "plugin/src/one.mjs": "one\n", "plugin/src/untracked.json": "{}\n" });
  try {
    const set = { ...setOf(["plugin/src/untracked.json"]), blind: [CAUSE] };
    assert.deepEqual(declared(where, set, declaring(["plugin/src"]), ["plugin/src/one.mjs", FILE]).spend, []);
    write(where.root, "plugin/src/untracked.json", `{ "moved": true }\n`);
    assert.deepEqual(again(where).spend, [FILE]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* A claim of `.` expands to the names at the top and the files there, which is what `under` means
   by it — so a walk of the root the audit saw would be authorised by containment and digested by a
   shallow listing, were the observed reads not in the entry beside the ceiling. */
test("a walk of the root the audit saw stays a walk in the entry, though the claim of `.` is shallow", () => {
  const where = room({ "CLAUDE.md": "the rules\n", "plugin/src/deep/one.mjs": "one\n" });
  try {
    const set = { ...setOf([], [], ["."]), blind: [CAUSE] };
    const said = declared(where, set, declaring(["."]), ["CLAUDE.md", FILE]);
    assert.deepEqual(said.escaped, [], "`.` covers a read of the root, by `under`'s own reading of it");
    assert.deepEqual(said.spend, []);
    write(where.root, "plugin/src/deep/two.mjs", "two\n");
    assert.deepEqual(again(where).spend, [FILE], "a file appearing deep, which a shallow listing would not move");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a declaration whose file derives its own set is reported as having had no effect", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    const said = declared(where, setOf(["plugin/src/one.mjs"]), declaring(["plugin/src"]), [FILE]);
    assert.deepEqual(said.dead, [{ file: FILE, blind: BLIND, where: FILE }]);
    assert.deepEqual(said.declared, [], "and the entry it wrote was derived, not declared");
    assert.equal(said.kept[0].set.declared, undefined);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* `matchIn` answers with the first entry whose own body digests to its own name, so a corrected
   ceiling would never take effect: the entry written under the old one is still a match. */
test("a claim widened or dropped unseats the entry the ceiling before it wrote", () => {
  const where = room({ "plugin/src/one.mjs": "one\n", "docs/two.md": "two\n" });
  const tracked = ["docs/two.md", "plugin/src/one.mjs", FILE];
  const set = { ...setOf(["plugin/src/one.mjs"]), blind: [CAUSE] };
  try {
    assert.deepEqual(declared(where, set, declaring(["plugin/src"]), tracked).spend, []);
    const wider = contextOf(["--test"], "", declaring(["plugin/src", "docs"]));
    assert.deepEqual(again(where, wider).spend, [FILE], "widened");
    assert.deepEqual(again(where, contextOf(["--test"], "", [])).spend, [FILE], "dropped");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a file declared twice has no answer for which paths it may read, and is refused by name", () => {
  assert.throws(() => declarationFor(FILE, [...declaring(["plugin/src"]), ...declaring(["docs"])]),
    new RegExp(`${FILE} is declared 2 times`, "u"));
  assert.equal(declarationFor(FILE, declaring(["plugin/src"])).blind, BLIND);
  assert.equal(declarationFor("plugin/test/other.test.mjs", declaring(["plugin/src"])), null,
    "a key is the file and never a directory of them, so nothing is enrolled by a prefix");
});

test("a claim that is a tracked file is that path, a directory is the walk and its files, and `.` the names at the top", () => {
  const tracked = ["CLAUDE.md", "plugin/src/one.mjs", "plugin/src/deep/two.mjs"];
  const none = { dirs: new Set(), trees: new Set(), whole: new Set() };
  assert.deepEqual(declaredSet(["CLAUDE.md"], tracked), { ...none, paths: new Set(["CLAUDE.md"]) });
  assert.deepEqual(declaredSet(["plugin/src"], tracked),
    { ...none, paths: new Set(["plugin/src/one.mjs", "plugin/src/deep/two.mjs"]), trees: new Set(["plugin/src"]) });
  assert.deepEqual(declaredSet(["."], tracked), { ...none, paths: new Set(["CLAUDE.md"]), dirs: new Set(["."]) });
});


/* The scratch's own gate, over the one path this repository's table really declares, so the wiring
   from the table through `recordSets` to the held-back block is proved and not only its parts. */
const DECLARING = "plugin/test/run/release/run-released-version.test.mjs";
const OUTSIDE = "docs/requirements/one.md";

/* A step that failed spent its files too, so a ceiling their reads escape is the tree's defect and
   not that step's: without this the one path where the gate exits 0 on a red step reports nothing. */
test("a declaration is judged on a step that failed, though nothing is written for one", () => {
  const where = room({ "plugin/src/one.mjs": "one\n", "docs/two.md": "two\n" });
  const set = { ...setOf(["plugin/src/one.mjs", "docs/two.md"]), blind: [CAUSE] };
  const table = declaring(["plugin/src"]);
  try {
    const judged = claimsJudged([set], { manifests: [], declared: table });
    assert.equal(judged.escaped.length, 1, "judged with no write in the call at all");
    assert.deepEqual(judged.escaped[0].escapes, [{ kind: "path", one: "docs/two.md" }]);
    const said = recordSets(where.dir, [set], { root: where.root, context: CONTEXT, manifests: [],
      tracked: ["plugin/src/one.mjs", "docs/two.md", FILE], declared: table, escaped: judged.escaped });
    assert.equal(said.wrote, 0, "and the escape the judgement found is what keeps the entry unwritten");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a declared blind file in a real run records against its declaration and is then held back", () => {
  assert.ok(declaredReads(DECLARING).includes("plugin/src"),
    `the case reads plugin/src/one.mjs, and ${DECLARING} no longer declares plugin/src`);
  assert.ok(!declaredReads(DECLARING).some((one) => OUTSIDE.startsWith(one)),
    `the case lands ${OUTSIDE}, and ${DECLARING} now declares it`);
  const { at, work } = scratch("declared-gate", null, null,
    { declaring: DECLARING, reading: ["plugin/src/one.mjs"] });
  try {
    landed(work, "plugin/src/one.mjs", "one, moved\n");
    assert.match(run(work).stdout,
      /reads: \d+ of \d+ test file\(s\) recorded what they asked for, \d+ by derivation and 1 against a declaration/u);
    landed(work, OUTSIDE, "the requirement moved\n");
    const { stdout } = run(work);
    assert.match(stdout, /=== reads: test — \d+ of \d+ test file\(s\) already answered for at this content, 1 of them by a declaration ===/u, stdout);
    assert.match(stdout, new RegExp(`skip ${DECLARING} {2}digest [0-9a-f]{12} {2}declared while blind on a git child that left no record`, "u"), stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a declared file whose real reads escape its ceiling fails the gate rather than banking the entry", () => {
  const { at, work } = scratch("declared-escape", null, null,
    { declaring: DECLARING, reading: ["plugin/src/one.mjs", OUTSIDE] });
  try {
    landed(work, "plugin/src/one.mjs", "one, moved\n");
    const said = run(work);
    assert.equal(said.status, 1, said.stdout);
    assert.match(said.stderr, new RegExp(`${DECLARING} read ${OUTSIDE} \\(path\\), which the declaration at ${DECLARING} does not cover`, "u"), said.stderr);
    assert.match(said.stderr, /Widen it in tools\/gates\/steps\.mjs, or drop it and let the file be spent/u);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* A ceiling is written against the blindness a run reported, so a file blind on two causes and
   reported on one is how ISS-1761's run aimed a ceiling at the wrong tree (ISS-1756). */
test("a declared file blind on more than one cause is named with every one of them", () => {
  const set = { ...setOf(["plugin/src/one.mjs"]),
    blind: [CAUSE, { kind: "export", why: "cpSync: a copy of a tree this one stands under" }] };
  const table = declaring(["plugin/src"]);
  const judged = claimsJudged([set], { manifests: [], declared: table });
  assert.deepEqual(judged.escaped, [], "the ceiling covers what was observed, and the causes are a separate reading");
  assert.equal(judged.several.length, 1);
  assert.deepEqual(severalCauses(judged.several[0]), [
    `reads: ${FILE} is blind on 2 cause(s) while the declaration at ${FILE} was written against `
    + `${BLIND}. A ceiling answers for every one of them:`,
    `  child: ${BLIND}`,
    "  export: cpSync: a copy of a tree this one stands under",
  ]);
  assert.deepEqual(claimsJudged([{ ...set, blind: [CAUSE] }], { manifests: [], declared: table }).several, [],
    "and one cause is no finding at all");
});

/* The lines themselves, pure: what the gate prints is what a run reads to decide whether a
   declaration is working, and the one clause this help may not drop is the residual it cannot check. */
test("the report names both counts, the dead claim's own blindness, and the escape's remedy", () => {
  assert.equal(wroteSets({ files: 292, wrote: 243, declared: 28 }),
    "reads: 243 of 292 test file(s) recorded what they asked for, 215 by derivation and 28 against a "
    + "declaration; 49 answered for nothing and are spent again");
  const kept = [{ file: FILE, digest: "0123456789ab", set: { declared: BLIND } },
    { file: "plugin/test/two.test.mjs", digest: "ba9876543210", set: {} }];
  const lines = readsSaid({ step: { label: "test" }, kept, spend: ["plugin/test/three.test.mjs"], unknown: [] });
  assert.match(lines[0], /3 test file\(s\) already answered for at this content, 1 of them by a declaration ===$/u);
  assert.match(lines[1], new RegExp(`^skip ${FILE} {2}digest 0123456789ab {2}declared while blind on ${BLIND}$`, "u"));
  assert.equal(lines[2], "skip plugin/test/two.test.mjs  digest ba9876543210", "a derived one carries no clause");
  assert.match(lines[3], /^spend 1 test file\(s\)/u, "and the spend clause ISS-1746 put beside them still follows");
  assert.match(deadClaim({ file: FILE, where: FILE, blind: BLIND }),
    new RegExp(`had no effect — it was recorded against ${BLIND}, and the audit reports no blindness now$`, "u"));
  assert.match(escapedClaim({ file: FILE, where: FILE, claims: ["plugin/src"], escapes: [{ kind: "walk", one: "docs" }] }),
    /read docs \(walk\), which the declaration at .+ does not cover: plugin\/src\. Widen it in tools\/gates\/steps\.mjs, or drop it/u);
});

/* The seam the section's own file leaves: the help is one document whichever module each paragraph
   is typed in, and a lost blank line joins two of them into one sentence. That seam is the only break
   asserted as one. Every other clause is read off the help with its paragraphs flowed onto one line
   each, because where a sentence wraps is typesetting that any rewrite of it moves, while a blank
   line inside one survives the flow and still fails here. */
const flowed = (text) => text.replace(/([^\n])\n(?!\n)/gu, "$1 ");

test("the help says what verifies a declaration and that the verification stops at the observed reads", () => {
  const said = run(ROOT.replace(/\/$/u, ""), ["-h"]).stdout;
  const flat = flowed(said);
  for (const clause of [
    "may instead be given a **declaration** in `tools/gates/steps.mjs`",
    "the reads the audit *did* see are checked against the ceiling on every run that spends the file",
    "The check is on the spend and never on a pass",
    "That verification reaches the observed reads and stops there",
    "no check can say a ceiling covers it, and this does not claim to",
    "its declaration is said to have had no effect against the blindness it was recorded under",
    "many files recorded a set by derivation and how many against a declaration",
    "A blind file carries **every** cause of its blindness",
  ]) {
    assert.ok(flat.includes(clause), `the help no longer says: ${clause}`);
  }
  assert.match(said, /stands in for it\.\n\nPast that, a step whose inputs/u, "the seam between two files' sections");
  assert.ok(!flat.includes("are both refused before a step is spent"),
    "the table's own two failures are this repository's checker and no condition of a run");
});
