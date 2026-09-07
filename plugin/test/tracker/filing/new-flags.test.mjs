/* What the verb sends the tracker for the flags a filing carries — the kind it names, the rank
   nobody gave it, and the edges it relates — measured by spawning it, the shape reader's own cases
   being `../issue-shape.test.mjs`'s. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

const home = tempHome("new-flags");
process.env.XDG_CONFIG_HOME = home.path;
const { markFor } = await import("../../../src/ladder.mjs");

const SHORT = "`forge dep` should take the `data.relations` route.";
const TITLE = "the filing is read against the shape before the tracker sees it";
const WHOLE = [
  "## Outcome",
  "",
  "A filing is read against the shape its kind names before the tracker sees the body.",
  "",
  "## Rules",
  "",
  "- A body missing a section its kind requires is refused with that section named.",
  "",
  "## Out of scope",
  "",
  "Judging whether the issue is true.",
].join("\n");

const state = {
  issues: [
    { issueId: "ISS-45", documentId: "uuid-45", status: "open", title: "three refusals carry the way out, forge dep under a token among them" },
    { issueId: "ISS-70", documentId: "uuid-70", status: "closed", title: "the browse projection answers with a cursor for the rows past the page" },
  ],
  comments: {},
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const room = tempHome("new-flags-room").path;
mkdirSync(join(home.path, "forge"), { recursive: true });
writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ url: tracker.url, token: "t" }));

const bodyAt = (body) => {
  const path = join(room, "body.md");
  writeFileSync(path, body);
  return path;
};
/* A filing names its kind or is refused, and that is not what most of the cases below are about,
   so the helper names one where the argv did not. */
const filed = (body, ...argv) => {
  const kind = argv.includes("--kind") ? [] : ["--kind", "feature"];
  return ranAsync(FORGE, ["new", bodyAt(body), ...argv, ...kind], tracker.env);
};

/* The kinds end to end: what the verb refuses before it reads anything, what it sends the tracker
   for the kind it was given, and what it says about a shortfall it files anyway. */
const BUG = [
  "## What happened",
  "",
  "`forge new` answered success and stored a description with no section in it.",
  "",
  "## Why it happens",
  "",
  "`plugin/src/tracker/issue-shape.mjs` reads the sections only where a kind was named.",
  "",
  "## Outcome",
  "",
  "A filing is read against the shape the kind it names asks for.",
  "",
  "## Rules",
  "",
  "- The refusal names the missing section and the kind that requires it.",
  "",
  "## Out of scope",
  "",
  "Any change to the tracker.",
].join("\n");

test("a kind outside the set is refused with the set, before a single tracker call", async () => {
  state.calls = [];
  const run = await filed(BUG, "--title", TITLE, "--kind", "chore");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No kind named chore\. The set is bug, enhancement, feature, review\./u);
  assert.deepEqual(state.calls, [], "nothing was asked of the tracker to find that out");
});

/* The flag decides both the sections the body is read against and the tracker's own field, and
   prose decides neither: the same headings carry a bug and a feature (ISS-334). */
test("a filing naming no kind is refused with the set, and files nothing", async () => {
  state.calls = [];
  const run = await ranAsync(FORGE, ["new", bodyAt(WHOLE), "--title", TITLE], tracker.env);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /A filing needs --kind/u);
  assert.match(run.stderr, /Name one of bug, enhancement, feature, review/u);
  assert.deepEqual(state.calls, [], "nothing was asked of the tracker to find that out");
});

/* The requirement is the filing verb's: a comment owes no shape and has no field to fill, so the
   verb that posts one is asked for no kind rather than refusing the flag two checks earlier. */
test("the comment verb needs no kind, and no shape either", async () => {
  state.calls = [];
  const run = await ranAsync(FORGE,
    ["comment", "ISS-45", bodyAt("`forge dep` writes the edge."), "--title", TITLE], tracker.env);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(state.calls.some((one) => one.name === "forge_comments" && one.args.action === "create"));
});

test("the kind the filing names is what the body is read against, and what the tracker is sent", async () => {
  state.calls = [];
  const refused = await filed(WHOLE, "--title", TITLE, "--kind", "bug");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /no heading naming what happened/u);
  assert.match(refused.stderr, /required of a bug/u);
  state.calls = [];
  const run = await filed(BUG, "--title", TITLE, "--kind", "bug");
  assert.equal(run.status, 0, run.stderr);
  const create = state.calls.find((one) => one.args.action === "create");
  assert.equal(create.args.data.category, "bug");
  assert.match(run.stdout, /"kind": "bug"/u, "and the answer is read back in the CLI's own word");
  assert.doesNotMatch(run.stdout, /category/u);
});

/* The ship step's own kind, filed by nobody: the body it generates is a feature's shape and the
   value it is stored under is what a reader filters a reading off a backlog by. */
test("a reading is filed under its own kind, against the sections a feature owes", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE, "--kind", "review");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.calls.find((one) => one.args.action === "create").args.data.category, "review");
  const short = await filed(WHOLE.slice(0, WHOLE.indexOf("## Out of scope")), "--title", TITLE, "--kind", "review");
  assert.equal(short.status, 1);
  assert.match(short.stderr, /out-of-scope heading.*required of a review/u);
});

/* A key in a body is as often a sentence's reason as it is related work, so the reply offers them
   and writes nothing; `--with` is what writes, and it takes the whole list at once. */
test("the keys a body names are offered under the reply and reach the tracker as no edge", async () => {
  state.calls = [];
  const cited = `${WHOLE}\n\nIt is why ISS-45 was filed, and ISS-52 says the same.`;
  const run = await filed(cited, "--title", TITLE);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^This body names ISS-45, ISS-52\. `--with ISS-45,ISS-52` relates what it names/mu);
  const create = state.calls.find((one) => one.args.action === "create");
  assert.equal("relations" in create.args.data, false, "a key found in a body wrote an edge");
});

test("--with takes several keys and relates each of them in the one create", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE, "--with", "ISS-45, ISS-70");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(state.calls.find((one) => one.args.action === "create").args.data.relations, [
    { kind: "relates", blocksId: "uuid-45" },
    { kind: "relates", blocksId: "uuid-70" },
  ], "a key that has closed still names an issue, which is what an edge to it says");
});

/* Twenty is the payload's own ceiling, so a longer list is refused rather than written short: the
   keys past the twentieth would be an input the call named and the tracker never carried. */
test("--with above what one create carries is refused, and asks the tracker nothing", async () => {
  state.calls = [];
  const many = Array.from({ length: 21 }, (_, at) => `ISS-${900 + at}`).join(",");
  const run = await filed(WHOLE, "--title", TITLE, "--with", many);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--with names 21 issues and one create carries 20 relations/u);
  assert.match(run.stderr, /the rest go on in a second write once this filing has a key/u,
    "and the way to relate the others is in the refusal, an unreachable edge being the whole cost");
  assert.deepEqual(state.calls, [], "nothing is looked up for a list that cannot be written");
});

/* A citation is not a key and a lookup for one costs the whole backlog, so the shape is judged
   where the list is parsed — above the rank read, which is the verb's first call. */
test("a --with key of the wrong shape is refused before any call, the rank read included", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE, "--with", "ISS-45,FR-05");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /neither an issue uuid nor an issue key/u);
  assert.match(run.stderr, /forge spec FR-05/u, "and a citation is told where it is read instead");
  assert.deepEqual(state.calls, [], "nothing is asked of the tracker for a list that cannot resolve");
});

test("a nice-to-have section left out is said on the way past, and the issue is filed", async () => {
  state.calls = [];
  const run = await filed(BUG, "--title", TITLE, "--kind", "bug");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /leaves out Where, nice to have on a bug/u);
  assert.ok(state.calls.some((one) => one.args.action === "create"), "said, not refused");
});

/* The mark reaches the tracker's field, flag-written or typed, so both sources agree from the create. */
test("--size marks the description and writes the tracker's field from that mark", async () => {
  /* The top rung buys no exemption, so its body still owes every section the shape asks for. */
  const created = async (body, ...argv) => {
    state.calls = [];
    const run = await filed(body, "--title", `forge dep writes an edge a token can write ${argv}`, ...argv);
    assert.equal(run.status, 0, run.stderr);
    return state.calls.find((one) => one.args.action === "create");
  };
  for (const [rung, held, body] of [["trivial", "xs", SHORT], ["fix", "s", SHORT], ["feature", "m", WHOLE]]) {
    const create = await created(body, "--size", rung);
    assert.match(create.args.data.description, new RegExp(markFor(rung), "u"));
    assert.equal(create.args.data.complexity, held, rung);
    assert.equal(create.args.data.status, "open", "and the same body is filed either way");
  }
  const typed = await created(`${SHORT}\n\n${markFor("trivial")}`);
  assert.equal(typed.args.data.complexity, "xs", "the line the filer typed writes the field too");
});

test("a filing that named no rank is filed at the bottom, and the reply says which line ranked it", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE);
  assert.equal(run.status, 0, run.stderr);
  const create = state.calls.find((one) => one.args.action === "create");
  assert.equal(create.args.data.priority, "none", "the tracker was left to fill its own middle");
  assert.match(run.stdout, /^filed-uuid is filed, priority none, by default\.$/mu);
});

test("a rank the filer typed is what is written, and the reply says it was theirs", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE, "--priority", "high");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.calls.find((one) => one.args.action === "create").args.data.priority, "high");
  assert.match(run.stdout, /is filed, priority high, as given\.$/mu);
});

/* The set is the tracker's, declared in its own schema: read at the call, so a rank outside it is
   refused here rather than filed and read back later as one somebody chose. */
test("a rank outside the tracker's set is refused before the body is even read", async () => {
  state.calls = [];
  const run = await filed(WHOLE, "--title", TITLE, "--priority", "urgent");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No priority named urgent/u);
  assert.match(run.stderr, /The set is critical, high, medium, low, none/u);
  assert.equal(state.calls.some((one) => one.args.action === "create"), false, "a refused rank filed an issue");
});

test("a rank is a filing flag, and the comment verb takes none of it", async () => {
  state.calls = [];
  const run = await ranAsync(FORGE,
    ["comment", "ISS-45", bodyAt(WHOLE), "--priority", "high"], tracker.env);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No comment flag named --priority\. The set is --title\./u);
  assert.equal(state.calls.some((one) => one.name === "forge_comments"), false);
});

/* The four paragraphs on what an unranked filing means are docs/cli/new.md's, and the help was a
   second copy of them. What a filer needs while the command is in their hand is on the flag line
   and in the reply, which says which of the two ranks was written; the value itself is refused
   against the tracker's own set, and that refusal carries the rest. */
test("`forge new -h` says what a filing with no rank gets, in the one line a flag row has", async () => {
  const run = await ranAsync(FORGE, ["new", "-h"], tracker.env);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}--priority P {3}.*unranked and the reply says so$/mu);
  assert.doesNotMatch(run.stdout, /sorts to the\nbottom of the browse verb/u,
    "and the paragraph the document owns is not printed beside it");
});

test("`forge new -h` lists every kind with the sections it requires", async () => {
  const run = await ranAsync(FORGE, ["new", "-h"], tracker.env);
  assert.equal(run.status, 0, run.stderr);
  for (const kind of ["bug", "enhancement", "feature", "review"]) assert.match(run.stdout, new RegExp(`\\n  ${kind} `, "u"));
  /* Criterion 5: the cause is on the bug's required row and on no other kind's. */
  assert.match(run.stdout, /required {3}What happened, Why it happens, Outcome, Rules, Out of scope/u);
  assert.match(run.stdout, /nice {7}Where/u);
  assert.match(run.stdout, /required {3}What happens today, Outcome, Rules, Out of scope/u);
  assert.match(run.stdout, /Usage: forge new/u, "and what to type is still the first line of it");
  /* The cause a bug owes is on its required row here and named by the gap a body missing it is
     refused with, so a filer meets it at the moment of filing either way. The paragraph about it
     stays on `forge feedback -h`, whose caller is standing in a checkout that holds none of these
     documents; docs/cli/the-kinds.md is where the rule itself lives. */
  assert.doesNotMatch(run.stdout, /names where the defect comes from/u);
  const said = await ranAsync(FORGE, ["feedback", "-h"], tracker.env);
  assert.match(said.stdout, /names where the defect comes from/u,
    "the defect route keeps it, because nothing else it can read says so");
});
