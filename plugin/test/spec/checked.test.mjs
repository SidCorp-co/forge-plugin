/* The write side of a citation, both verbs through one step: what `forge record criteria` refuses
   in a criterion's opening, what it leaves alone in a criterion's prose, and what an issue has to
   name before `approved`. The verb cases run the CLI in a fixture project, because the span each
   caller hands over is the whole of what this module decides. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../fixtures.mjs";

const scratch = [];
const temporary = (prefix) => {
  const dir = tempRoom(prefix);
  scratch.push(dir);
  return dir;
};
after(() => scratch.forEach((dir) => rmSync(dir, { force: true, recursive: true })));

process.env.XDG_CONFIG_HOME = temporary("checked-");
const { TREE } = await import("../../src/spec/tree.mjs");
const { criteriaChecked } = await import("../../src/spec/checked.mjs");
const { opensWith } = await import("../../src/spec/parse.mjs");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;

const REQUIREMENT = `# SRS §3 — FR-01 — The first capability

Rev: 2 · Actors: agent · Enforces: BR-01

## Purpose

*Why does this requirement exist?*

Because a clause nobody can cite is a clause nobody can trace.

## Use cases

*What has to exist?*

### UC-01-1 — A clause read by its identifier

Rev: 1 · Actors: agent · Enforces: BR-01

The identifier is the whole surface.

- **AC-01-1-1** · Rev: 1 · Proof: none yet — ISS-99
  WHEN a clause is asked for THEN the CLI SHALL print it.
- **AC-01-1-2** · Rev: 3 · Proof: none yet — ISS-99
  IF the identifier is unknown THEN the CLI SHALL refuse.
`;

const project = (prefix, withTree) => {
  const root = temporary(prefix);
  writeFileSync(join(root, ".forge.json"), '{"slug":"checked-fixture"}');
  if (withTree) {
    const srs = join(root, TREE, "srs");
    mkdirSync(srs, { recursive: true });
    writeFileSync(join(srs, "fr-01-first.md"), REQUIREMENT);
  }
  return root;
};

/* The verb's next step after the check is the tracker, and a temporary config directory holds no
   endpoint: a run that reached this refusal is a run the citation check let through. */
const REACHED_THE_TRACKER = /No Forge endpoint/u;

const written = (root, text) => {
  const file = join(root, "criteria.md");
  writeFileSync(file, text);
  return spawnSync(FORGE, ["record", "criteria", "ISS-1", file], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, FORGE_CODEX_DISABLE: "1" },
  });
};

test("a criterion opening with an identifier that names no clause is refused with the nearest ones", () => {
  const run = written(project("crit-unknown-", true), "1. AC-01-1-9~1: the outcome.\n");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /nothing was written/u);
  assert.match(run.stderr, /No clause named AC-01-1-9/u);
  assert.match(run.stderr, /AC-01-1-1/u, "and the clauses it might have meant");
});

test("a criterion opening at a revision the clause has moved past names the revision it is at now", () => {
  const run = written(project("crit-stale-", true), "1. AC-01-1-2~1: the outcome.\n");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /AC-01-1-2~1 is stale/u);
  assert.match(run.stderr, /at revision 3, not 1/u);
});

test("a criterion opening with a rule of the tree's own index is told it is one", () => {
  const run = written(project("crit-rule-", true), "1. R-10~1: the outcome.\n");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /R-10 names a rule of this tree/u);
  assert.match(run.stderr, /not a clause of the specification/u);
});

test("a criterion opening with a bare identifier is written, and R-10 is said over it", () => {
  const run = written(project("crit-bare-", true), "1. UC-01-1: the outcome.\n");
  assert.match(run.stderr, /R-10 asks for/u);
  assert.match(run.stderr, REACHED_THE_TRACKER, "a said line stops nothing");
});

/* The narrowing AC-14-4-1 states, and the case that pays for it: ISS-28's own shipped criterion 7
   quotes this very identifier to say what the reader answers for it. */
test("an identifier a criterion names after its first word is prose, and settles nothing", () => {
  const run = written(project("crit-prose-", true), "1. The reader answers [] for `R-10~1`, and nothing is refused.\n");
  assert.match(run.stderr, REACHED_THE_TRACKER);
  assert.ok(!run.stderr.includes("rule of this tree"), run.stderr);
});

test("a criterion opening with a citation that resolves says nothing about citations", () => {
  const run = written(project("crit-clean-", true), "1. UC-01-1~1: the outcome.\n");
  assert.match(run.stderr, REACHED_THE_TRACKER);
  assert.ok(!run.stderr.includes("R-10"), run.stderr);
});

test("a project with no requirements tree writes its criteria as it always did", () => {
  const run = written(project("crit-no-tree-", false), "1. AC-01-1-9~1: the outcome.\n");
  assert.match(run.stderr, REACHED_THE_TRACKER, "the citation nothing resolved it against never refused it");
  assert.ok(!run.stderr.includes(TREE), `a project with no tree is never told about one: ${run.stderr}`);
});

test("an unnumbered line is refused before any citation is read, so the numbering still speaks first", () => {
  const run = written(project("crit-unnumbered-", true), "AC-01-1-9~1: not a numbered line.\n");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Every criterion is a numbered line/u);
  assert.ok(!run.stderr.includes("No clause named"), run.stderr);
});

test("the opening is where a reference is read, and nowhere else in the text", () => {
  assert.deepEqual(opensWith("AC-01-1-1~2: the outcome."), { id: "AC-01-1-1", prefix: "AC", rev: 2 });
  assert.deepEqual(opensWith("AC-01-1-1: the outcome."), { id: "AC-01-1-1", prefix: "AC", rev: null });
  assert.equal(opensWith("the AC-01-1-1~2 case answers nothing"), null);
  assert.deepEqual(opensWith("  UC-01-1~1 : indented, and spaced off its colon"), { id: "UC-01-1", prefix: "UC", rev: 1 });
  assert.equal(opensWith("UC-01-1~1 the outcome, with no colon"), null, "the colon is what says the reference is the opening");
  assert.equal(opensWith(""), null);
});

/* `criteriaChecked` is handed `criteriaLines`'s shape, so the case that proves it reads nothing is
   the one where no criterion opens with a reference: a raise that fires would be the tree read. */
test("nothing is read where no criterion opens with a reference", () => {
  let raised = 0;
  criteriaChecked([{ number: 1, text: "an outcome naming nothing" }], () => { raised += 1; });
  assert.equal(raised, 0);
});

const clauses = (root, issue) => spawnSync(process.execPath, [
  "-e",
  `import("${new URL("../../src/spec/checked.mjs", import.meta.url).pathname}")`
    + `.then((m) => console.log(JSON.stringify(m.citedClauses(${JSON.stringify(issue)}))));`,
], { encoding: "utf8", cwd: root }).stdout.trim();

test("a project with no tree answers null, which is the one answer that owes nothing", () => {
  assert.equal(clauses(project("cited-no-tree-", false), { description: "serves UC-01-1~1" }), "null");
});

test("the clauses an issue names are resolved, not recognised by their prefix", () => {
  const root = project("cited-tree-", true);
  assert.equal(clauses(root, { description: "serves UC-01-1~1" }), '["UC-01-1"]');
  assert.equal(clauses(root, { plan: "serves AC-01-1-1~1" }), '["AC-01-1-1"]');
  assert.equal(clauses(root, { acceptanceCriteria: "1. AC-01-1-2~3: the outcome." }), '["AC-01-1-2"]');
  assert.equal(clauses(root, { description: "serves FR-999999~1" }), "[]", "a prefix and a revision are not a clause");
  assert.equal(clauses(root, { description: "serves R-10~1" }), "[]", "a rule of the index is not a clause");
  assert.equal(clauses(root, { description: "serves UC-01-1" }), "[]", "a revision is what makes a citation");
  assert.equal(clauses(root, {}), "[]", "a tree with nothing cited is empty and never null");
});

test("citedClauses is the only reader here that touches the checkout", () => {
  const root = project("cited-untrusted-", true);
  const fenced = "⟦UNTRUSTED_DATA source=\"issue.description\"⟧\nserves UC-01-1~1\n⟦END_UNTRUSTED_DATA⟧";
  assert.equal(clauses(root, { description: fenced }), '["UC-01-1"]', "the tracker's own wrapping names no identifier");
});

/* The three shapes this step exists to hold: one home for the check, `earned.mjs` proved from a
   fixture because it reaches no checkout, and `spec/` free of the edge back into `flow/` that made
   a shared step unreachable from `record.mjs` in the first place. */
const source = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

test("the citation check has one home, and the verbs reach it rather than spelling it", () => {
  const record = source("src/flow/record/fields.mjs");
  assert.ok(record.includes('from "../../spec/checked.mjs"'), "both field writes spend the shared step");
  assert.ok(/citationsChecked\b/u.test(record), "record plan over the plan's whole text");
  assert.ok(/criteriaChecked\b/u.test(record), "record criteria over each criterion's opening");
  assert.ok(!record.includes("citationRefusal"), "and neither assembles the refusal itself");
  assert.ok(!source("src/flow/record/record.mjs").includes("spec/checked.mjs"),
    "and the module those two writes moved out of no longer reaches it at all");
  assert.ok(!source("src/commands.mjs").includes("spec/checked.mjs"),
    "and the verb table reaches it through no route of its own");
});

test("earned.mjs reaches no checkout, so every entry check is proved from a fixture", () => {
  const earned = source("src/flow/earned.mjs");
  assert.ok(!/node:fs/u.test(earned), "an entry check that reads the tree cannot be fixtured");
  for (const reader of ["spec/tree.mjs", "spec/checked.mjs"]) {
    assert.ok(!earned.includes(reader), `earned.mjs imports ${reader}, which reads the checkout`);
  }
});

test("no module of spec/ imports from flow/, which is the edge the shared step could not cross", () => {
  const dir = new URL("../../src/spec/", import.meta.url).pathname;
  for (const name of readdirSync(dir).filter((one) => one.endsWith(".mjs"))) {
    const text = readFileSync(join(dir, name), "utf8");
    assert.ok(!/from "\.\.\/flow\//u.test(text), `plugin/src/spec/${name} imports from plugin/src/flow/`);
  }
});

/* The switch is the project's, so an injected argument proves the paragraph and not that the shipped
   help asks the disk for it: both commands are run in a fixture project either way (ISS-516). */
test("the two file writes' help carries the citation where a project keeps a tree, and not where it does not", () => {
  for (const kind of ["criteria", "plan"]) {
    const run = (root) => spawnSync(FORGE, ["record", kind, "-h"],
      { cwd: root, encoding: "utf8", env: process.env });
    const kept = run(project(`cited-help-${kind}-`, true));
    assert.equal(kept.status, 0, kept.stderr);
    assert.match(kept.stdout, /opening with `<id>~<rev>:`/u, `${kind} names the form a criterion opens with`);
    assert.match(kept.stdout, /the description, the plan or the criteria/u, `${kind} names the fields it may sit in`);
    const none = run(project(`uncited-help-${kind}-`, false));
    assert.equal(none.status, 0, none.stderr);
    assert.doesNotMatch(none.stdout, /<id>~<rev>/u, `${kind} asks a project keeping no tree for nothing`);
  }
});
