/* The reverse read: which issues cite a clause, obtained from the search route and narrowed against
   the tree, and what the verb spends on it. Run through the CLI in a fixture project, because what
   this decides is the calls, and a call nobody made is what the budget rules are about. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, shortPage, tempRoom } from "../fixtures.mjs";

const { TREE } = await import("../../src/spec/tree.mjs");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const LANDED = "c8c3550";
const JUDGED = "43b811e";

const REQUIREMENT = `# SRS §1 — FR-01 — The first capability

Rev: 1 · Actors: agent

## Use cases

*What has to exist?*

### UC-01-1 — A clause read by its identifier

Rev: 1 · Actors: agent

The identifier is the whole surface.

- **AC-01-1-1** · Rev: 1 · Proof: none yet — ISS-99
  WHEN a clause is asked for THEN the CLI SHALL print it.
- **AC-01-1-2** · Rev: 1 · Proof: none yet — ISS-99
  IF the identifier is unknown THEN the CLI SHALL refuse.
`;

const project = (prefix) => {
  const root = tempRoom(prefix);
  writeFileSync(join(root, ".forge.json"), readFileSync(new URL("../../../.forge.json", import.meta.url), "utf8"));
  const srs = join(root, TREE, "srs");
  mkdirSync(srs, { recursive: true });
  writeFileSync(join(srs, "fr-01-first.md"), REQUIREMENT);
  return root;
};

const issue = (over) => ({
  documentId: `${over.issueId.toLowerCase()}-uuid`,
  status: "closed",
  mergedAt: "2026-09-02T09:00:00.000Z",
  matchedFields: ["acceptanceCriteria"],
  description: "",
  plan: "## Declarations\n\nscreen change: no\nuser-facing outcome: no\n",
  acceptanceCriteria: "",
  ...over,
});

/* One issue per shape the narrowing and the budget are about: one that proves the clause, one whose
   criteria open on nothing, and one the index matches on the identifier written as prose. */
const PROVER = issue({
  issueId: "ISS-1",
  title: "proves it",
  acceptanceCriteria: "1. AC-01-1-1~1: the first outcome.",
});
const MENTIONS = issue({
  issueId: "ISS-2",
  title: "cites it in the body alone",
  status: "open",
  mergedAt: null,
  description: "This serves AC-01-1-1~1 and carries no criterion about it.",
  acceptanceCriteria: "1. Something else entirely.",
});
const PROSE = issue({
  issueId: "ISS-3",
  title: "names AC-01-1-1 as prose and cites the sibling clause",
  status: "open",
  mergedAt: null,
  description: "A reader that took AC-01-1-1 for a citation would resolve a clause nobody cited.",
  acceptanceCriteria: "1. AC-01-1-2~1: the outcome this issue is actually about.",
});

const COMMENTS = {
  "iss-1-uuid": [
    { createdAt: "2026-09-02T10:00:00.000Z", authorId: "agent",
      body: `mark_merged target=base — merged to master at ${LANDED}; judged head ${JUDGED}; `
        + "landing moved nothing" },
    { createdAt: "2026-09-02T10:01:00.000Z", authorId: "agent",
      body: `## Criterion judged\n\n\`\`\`forge-record\ncriterion: 1\nverdict: pass\ncommit: ${JUDGED}\nevidence: run.txt\n\`\`\`\n\n\`forge-record: verdict · contract 1\`` },
  ],
};

const trackerFor = async (state) => {
  const held = { issues: [PROVER, MENTIONS, PROSE], comments: COMMENTS, ...state };
  const tracker = await fakeTracker(held);
  return { tracker, held };
};

const searches = (calls) => calls.filter((one) => (one.path ?? "").endsWith("/issues/search"));
const threads = (calls) => calls.filter((one) => /\/comments$/u.test(one.path ?? ""));

test("the citing set is what the tree resolves, not what the index matched", async () => {
  const { tracker, held } = await trackerFor({});
  const run = await ranAsync(FORGE, ["spec", "AC-01-1-1", "--status"], tracker.env, project("citing-narrow-"));
  tracker.close();
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /AC-01-1-1 {2}verified {2}proved by ISS-1; also cited by ISS-2/u);
  assert.ok(!run.stdout.includes("ISS-3"),
    `a row the index matched whose only citation is of another clause is dropped:\n${run.stdout}`);
  assert.equal(searches(held.calls).length, 1, "one ask for the one clause asked about");
});

test("a criterion opening at a revision is answered by the bare identifier the reader asks with", async () => {
  const { tracker, held } = await trackerFor({});
  await ranAsync(FORGE, ["spec", "AC-01-1-1", "--status"], tracker.env, project("citing-revision-"));
  tracker.close();
  assert.deepEqual(searches(held.calls).map((one) => one.query.q), ["AC-01-1-1"],
    "the ask carries no revision, and the criterion it found writes one");
});

test("the comment read is spent on the issues that could prove the clause and on no others", async () => {
  const { tracker, held } = await trackerFor({});
  await ranAsync(FORGE, ["spec", "AC-01-1-1", "--status"], tracker.env, project("citing-budget-"));
  tracker.close();
  assert.deepEqual(threads(held.calls).map((one) => one.path.split("/")[3]), ["iss-1-uuid"],
    "the open issue and the prose match are closed out before a thread of either is read");
});

test("a requirement costs one ask per clause under it and never a walk of the project", async () => {
  const { tracker, held } = await trackerFor({});
  const run = await ranAsync(FORGE, ["spec", "FR-01", "--status"], tracker.env, project("citing-per-clause-"));
  tracker.close();
  assert.deepEqual(searches(held.calls).map((one) => one.query.q).sort(), ["AC-01-1-1", "AC-01-1-2"]);
  assert.match(run.stdout, /AC-01-1-2 {2}partial {3}cited by ISS-3/u,
    "each clause under it read on its own ask, and the sibling's citer found there and not here");
  assert.match(run.stdout, /Status of FR-01: partial/u, "the requirement at the lowest rung any took");
});

test("a citing set the route cut short earns no rung and says it was cut", async () => {
  const { tracker, held } = await trackerFor({
    answer: { forge_issues: (args) => (args.action === "list"
      ? shortPage([PROVER], 5)()
      : { documentId: args.documentId }) },
  });
  const run = await ranAsync(FORGE, ["spec", "AC-01-1-1", "--status"], tracker.env, project("citing-cut-"));
  tracker.close();
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /AC-01-1-1 {2}no rung/u);
  assert.match(run.stdout, /the reading is incomplete/u);
  assert.ok(!run.stdout.includes("unclaimed"), `a cut set may not read as a clause nobody claimed:\n${run.stdout}`);
  assert.equal(threads(held.calls).length, 0, "and nothing is judged off a set that may be short");
});

test("a prover whose record came back a prefix earns the clause no rung either", async () => {
  const { tracker } = await trackerFor({
    answer: { forge_comments: (args) => (args.action === "list"
      ? { comments: COMMENTS["iss-1-uuid"], returned: 2, total: 9, hasMore: true }
      : { documentId: "comment-uuid" }) },
  });
  const run = await ranAsync(FORGE, ["spec", "AC-01-1-1", "--status"], tracker.env, project("citing-prefix-"));
  tracker.close();
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /AC-01-1-1 {2}no rung/u,
    "a pass read off a prefix is a pass that may have a fail after it");
  assert.match(run.stdout, /ISS-1: The thread was walked and stopped after 2 comment\(s\) of 9/u);
});

test("the clause read without the flag asks the tracker nothing at all", async () => {
  const { tracker, held } = await trackerFor({});
  const run = await ranAsync(FORGE, ["spec", "AC-01-1-1"], tracker.env, project("citing-offline-"));
  tracker.close();
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /AC-01-1-1/u);
  assert.deepEqual(held.calls ?? [], [], "a citation check that reached the tracker would pay for every write");
});

test("a tracker that refuses the citing read costs the rung and never the clause", async () => {
  const { tracker } = await trackerFor({ status: 500 });
  const run = await ranAsync(FORGE, ["spec", "AC-01-1-1", "--status"], tracker.env, project("citing-refused-"));
  tracker.close();
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /AC-01-1-1 {2}rev 1/u, "the clause is read off the checkout and still printed");
  assert.match(run.stdout, /AC-01-1-1 {2}no rung/u);
  assert.match(run.stdout, /the tracker refused it/u, "and the refusal is what the cut names");
});

test("a project keeping no requirements tree is told what it is told today, and nothing is derived", async () => {
  const { tracker, held } = await trackerFor({});
  const root = tempRoom("citing-no-tree-");
  writeFileSync(join(root, ".forge.json"), readFileSync(new URL("../../../.forge.json", import.meta.url), "utf8"));
  const run = await ranAsync(FORGE, ["spec", "AC-01-1-1", "--status"], tracker.env, root);
  tracker.close();
  assert.equal(run.status, 1);
  assert.match(run.stderr, /This project has no requirements tree/u);
  assert.ok(!run.stdout.includes("Status of"), `nothing is derived for it:\n${run.stdout}`);
  assert.deepEqual(held.calls ?? [], [], "and the flag costs no call where there is no clause to derive one for");
});

test("the json half carries the rung the print carries, and no field stores it", async () => {
  const { tracker } = await trackerFor({});
  const run = await ranAsync(FORGE, ["spec", "AC-01-1-1", "--status", "--json"], tracker.env, project("citing-json-"));
  tracker.close();
  const held = JSON.parse(run.stdout);
  assert.equal(held.status.rung, "verified");
  assert.deepEqual(held.status.clauses.map((one) => one.rung), ["verified"]);
  assert.deepEqual(held.status.clauses[0].provers, ["ISS-1"]);
  assert.ok(!held.clauses.some((one) => Object.hasOwn(one, "rung")),
    "the clause as the tree holds it carries no status: it is derived at the read and stored nowhere");
});

/* The derivation reads verdicts, a merged mark and a park, which are the workflow's records, so it
   is no module of `spec/` — plugin/test/spec/checked.test.mjs holds that edge, and this holds the
   wiring that lets the flag exist without crossing it. */
test("the clause reader still imports no workflow, and the verb table is what joins the two", () => {
  const dir = new URL("../../src/spec/", import.meta.url).pathname;
  for (const name of readdirSync(dir).filter((one) => one.endsWith(".mjs"))) {
    assert.ok(!/from "\.\.\/flow\//u.test(readFileSync(join(dir, name), "utf8")),
      `plugin/src/spec/${name} imports the workflow the status reader was moved out of spec/ to reach`);
  }
  const table = readFileSync(new URL("../../src/commands.mjs", import.meta.url).pathname, "utf8");
  assert.match(table, /readStatus: statusOf/u,
    "the verb table wires the reader, or `--status` is a flag read and dropped");
  assert.match(table, /import\("\.\/trace\/citing\.mjs"\)/u,
    "and takes it from the module that reads both sides, loaded where the verb is");
});
