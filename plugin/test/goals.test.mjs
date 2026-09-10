/* What a project is for, and the `Serves:` line a record or a filing names one of its goals on.
   Spawned rather than called for the halves a caller reads — the goal list on `forge project`, the
   block in three `-h` routes, the refusal that writes nothing — and called for the two readers,
   whose cases are grammar and cost no process. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeStore, fakeTracker, ranAsync, tempHome } from "./fixtures.mjs";

const home = tempHome("goals");
process.env.XDG_CONFIG_HOME = home.path;
const { NONE_STATED, NOT_STATED, SECTION, goalsIn, resolvedBy, servesIn, servesSaid } =
  await import("../src/goals.mjs");

const FORGE = new URL("../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../..", import.meta.url).pathname;
const ISSUE = "33333333-3333-4333-8333-333333333333";
const held = { documentId: ISSUE, issueId: "ISS-1", status: "confirmed", title: "one" };

const BRIEF = [
  "# a project's map",
  "",
  "Build: none.  ← `CLAUDE.md`",
  "",
  `## ${SECTION}`,
  "",
  "**G-01** A status is earned by a record, or it does not move.  ← `docs/requirements/brd/03-goals-non-goals.md`",
  "- **G-02** Every payload has one shape the CLI owns.  ← `docs/requirements/brd/03-goals-non-goals.md`",
  "G-03 One run holds an issue at a time.  ← `docs/requirements/brd/03-goals-non-goals.md`",
  "",
  "## Where credentials come from",
  "",
  "G-99 is under another heading and is no goal of this project.",
].join("\n");

const { store, knowledge } = fakeStore();
const brief = (body) => store.set("project-brief", {
  id: "k-project-brief", slug: "project-brief", kind: "overview", title: "the map", body,
  injection: "always", confidence: "inferred", authoredBy: "agent", metadata: {},
  updatedAt: "2026-09-06T21:00:00.000Z",
});

const state = {
  issues: [held],
  comments: { [ISSUE]: [] },
  answer: {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: [held], returned: 1, hasMore: false };
      if (args.action === "get") return held;
      if (args.action === "update") return Object.assign(held, args.data);
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_config: () => ({ config: { baseBranch: "master", productionBranch: "master" } }),
    "forge_projects.get": () => ({ project: {} }),
    forge_knowledge: (args) => (state.storeDown
      ? { refused: "Error: the store is unreachable" }
      : knowledge(args)),
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());
mkdirSync(join(home.path, "forge"), { recursive: true });
writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ url: tracker.url, token: "t" }));
const ask = (...argv) => ranAsync(FORGE, argv, tracker.env, ROOT);

/* The goal line is the last thing this report prints and every line under `route table` is a
   tracker read, so a run whose fixture tracker went unread has no goal line to find: it is named
   here, before the regex three lines down blames a goal list that moved (ISS-891). Doctor's status
   is its own verdict on the machine — a fixture endpoint misses several probes — and says nothing
   about which half of the report answered. */
const briefRead = (run) => {
  assert.ok([0, 1].includes(run.status), `${run.status}: ${run.stderr}`);
  const stopped = run.stdout.trimEnd().split("\n").at(-1);
  assert.match(run.stdout, /^\[ {2}ok {2}\] project id/mu,
    `this report never reached the tracker, so it read no brief. Stopped at: ${stopped}. Stderr: ${run.stderr}`);
  return run.stdout;
};

const room = tempHome("goals-room").path;
const bodyAt = (body) => {
  const path = join(room, "body.md");
  writeFileSync(path, body);
  return path;
};

const bug = (serves) => [
  "## What happened",
  "",
  "`forge new` stored a body with no goal on it.",
  "",
  "## Why it happens",
  "",
  "`plugin/src/tracker/filing/route.mjs` writes the description before any goal is read.",
  "",
  "## Outcome",
  "",
  "A filing says which goal it serves.",
  ...(serves ? ["", `Serves: ${serves}`] : []),
  "",
  "## Rules",
  "",
  "- The refusal names the list the brief holds.",
  "",
  "## Out of scope",
  "",
  "Any change to the tracker.",
].join("\n");

brief(BRIEF);
await ask("claim", "ISS-1");

/* The two readers: what a brief states, and what a body says it serves. Grammar, so no process. */
test("the goals are the identified lines of that one section, and nothing under the next heading", () => {
  const read = goalsIn(BRIEF);
  assert.deepEqual(read.goals.map((one) => one.id), ["G-01", "G-02", "G-03"],
    "bold, bulleted and bare each identify a line; G-99 sits under another heading");
  assert.equal(read.why, null);
  assert.equal(read.goals[0].text, "A status is earned by a record, or it does not move.",
    "a goal's words end where the line's provenance starts");
});

test("a brief with no such section states no goal, and says which reason", () => {
  const read = goalsIn("# a map\n\nBuild: none.\n");
  assert.deepEqual(read.goals, []);
  assert.match(read.why, new RegExp(`no \\*${SECTION}\\*`, "u"));
});

test("a section that identifies nothing is told from one that is absent", () => {
  const read = goalsIn(`## ${SECTION}\n\nnot stated: nobody has written this project's goals down.\n`);
  assert.deepEqual(read.goals, []);
  assert.match(read.why, /identifies no goal/u);
});

test("a Serves: line inside an example is shown and not claimed", () => {
  assert.deepEqual(servesIn("Serves: G-02\n"), ["G-02"]);
  assert.deepEqual(servesIn("```\nServes: G-02\n```\n"), [], "a fenced line is what a body shows");
  assert.deepEqual(servesIn("nothing here says it\n"), []);
  assert.equal(servesSaid([]), NONE_STATED);
});

/* The two sources, and the overlap that is not equivalence: this repository's own goals are rows of
   its tree, and a clause outside the brief's list is still a clause the issue lets a run name. */
test("either source answers, and neither answering is what a refusal is for", () => {
  const read = goalsIn(BRIEF);
  assert.match(resolvedBy("G-02", read.goals), new RegExp(SECTION, "u"));
  assert.match(resolvedBy("g-02", read.goals), new RegExp(SECTION, "u"), "the identifier is not case");
  assert.equal(resolvedBy("NOPE-99", read.goals), null);
  assert.equal(resolvedBy("not an identifier at all", read.goals), null);
  assert.ok(resolvedBy(NONE_STATED, read.goals), "the line the method calls legal");
  assert.ok(resolvedBy("FR-04", read.goals, true), "a clause of the checkout's own tree");
  assert.equal(resolvedBy("FR-04", read.goals, false), null,
    "and that tree answers for nothing where the write is going to a project it is not");
});

test("forge doctor prints the identifiers the brief's own section holds", async () => {
  brief(BRIEF);
  const read = briefRead(await ask("doctor"));
  assert.match(read, new RegExp(`^ {2}goals: G-01, G-02, G-03 — read from the brief's \\*${SECTION}\\*`, "mu"));
});

test("a brief with no section prints the line as not stated, and names what writes one", async () => {
  brief("# a map\n\nBuild: none.  ← `CLAUDE.md`\n");
  try {
    const read = briefRead(await ask("doctor"));
    assert.match(read, new RegExp(`^ {2}goals: ${NOT_STATED} — .*no \\*${SECTION}\\* section`, "mu"));
    assert.match(read, /forge doctor --refresh <brief\.md>/u);
  } finally {
    /* Restored whatever this asserted: every test below reads the brief, and one of them failing
       for the brief this one left behind is a failure naming the wrong test. */
    brief(BRIEF);
  }
});

test("a Serves: no source answers for is refused with the brief's list, and nothing is posted", async () => {
  state.calls = [];
  const run = await ask("record", "decision", "ISS-1", "--decision", "a | b | c", "--serves", "NOPE-99");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /neither source of this project answers for it/u);
  assert.match(run.stderr, new RegExp(`its brief's \\*${SECTION}\\* section: G-01, G-02, G-03`, "u"));
  assert.match(run.stderr, /its requirements tree: no clause `NOPE-99`/u);
  assert.match(run.stderr, new RegExp(`Serves: ${NONE_STATED}`, "u"));
  assert.equal(state.calls.filter((one) => one.args?.action === "create").length, 0);
});

/* The clause the brief does not list: `FR-04` is a row of this repository's tree and no goal of the
   fixture's brief, which is the case the one-authority reading would have refused. */
test("a clause the tree resolves is accepted where the brief's section does not list it", async () => {
  const run = await ask("record", "decision", "ISS-1", "--decision", "a | b | c", "--serves", "FR-04");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^serves: FR-04$/mu);
});

test("a decision naming no goal is written none stated rather than left off the record", async () => {
  const run = await ask("record", "decision", "ISS-1", "--decision", "a | b | c");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(`^serves: ${NONE_STATED}$`, "mu"));
});

test("the goal list reaches the help of every verb whose write may name one", async () => {
  for (const argv of [["record", "decision", "-h"], ["new", "-h"], ["feedback", "-h"]]) {
    const run = await ask(...argv);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^ {2}G-01 {2}A status is earned by a record, or it does not move\.$/mu,
      `${argv.join(" ")} prints the list`);
    assert.match(run.stdout, /forge guide issue-flow/u, "and cites the method rather than restating it");
  }
});

test("a store that will not answer for the brief leaves every help route printing its usage", async () => {
  state.storeDown = true;
  for (const argv of [["record", "decision", "-h"], ["new", "-h"], ["feedback", "-h"]]) {
    const run = await ask(...argv);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /would not answer for this project's brief/u, argv.join(" "));
    assert.doesNotMatch(run.stdout, /G-01/u, "and no list is invented for it");
  }
  state.storeDown = false;
});

test("a filing whose Serves: no source answers for is refused with the list, and files nothing", async () => {
  state.calls = [];
  const run = await ask("new", bodyAt(bug("NOPE-99")), "--title", "a filing says which goal it serves", "--category", "bug");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, new RegExp(`its brief's \\*${SECTION}\\* section: G-01, G-02, G-03`, "u"));
  assert.equal(state.calls.filter((one) => one.args?.action === "create").length, 0);
});

test("a goal the brief holds, the legal none-stated line, and no line at all each file unrefused", async () => {
  for (const serves of ["G-02", NONE_STATED, null]) {
    const run = await ask("new", bodyAt(bug(serves)), "--title", `filed with ${serves ?? "no line"}`,
      "--category", "bug", "--new");
    assert.equal(run.status, 0, `${serves ?? "no line"}: ${run.stderr}`);
  }
});

/* Which sources answer is the destination's question, and a note's destination is never the checkout
   it was typed in: `forge feedback` re-aims the brief, and `docs/requirements/` here is whatever
   backlog the caller is standing in. A clause was being read off that tree and called this one's. */
test("a note filed from another checkout is read against this plugin's brief and no local tree", async () => {
  const foreign = tempHome("goals-foreign").path;
  writeFileSync(join(foreign, ".forge.json"), JSON.stringify({ slug: "somebody-elses-project" }));
  const note = join(foreign, "note.md");
  writeFileSync(note, bug("FR-04"));
  const away = await ranAsync(FORGE, ["feedback", note, "--title", "a note names a clause", "--new"],
    tracker.env, foreign);
  assert.equal(away.status, 1, away.stdout);
  assert.match(away.stderr, /its requirements tree: not read from here/u);
  assert.match(away.stderr, new RegExp(`its brief's \\*${SECTION}\\* section: G-01, G-02, G-03`, "u"));
  const home = await ask("feedback", bodyAt(bug("FR-04")), "--title", "a clause of its own tree", "--new");
  assert.equal(home.status, 0, home.stderr);
});

test("forge next --why prints the goal beside the score and no weight moves for it", async () => {
  const run = await ask("next", "--why", "--count", "1");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(`^ {2}serves ${NONE_STATED}$`, "mu"));
  assert.doesNotMatch(run.stdout, /why .*serves/u, "the weights line is untouched by it");
});
