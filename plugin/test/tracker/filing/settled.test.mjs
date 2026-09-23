/* What a filing is told about the issues the project already settled beside it: which rows count,
   the reason a dropped one's own record gives, what an unread thread says, the two blocks and the
   empty lines that tell "nothing was filed" from "filed and settled". Called rather than spawned,
   because what is asserted is which rows came back and what each line says of them; the spawned
   filing is beside.test.mjs's and the reasoning docs/cli/beside.md's. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, projectRecord } from "../../fixtures.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

const row = (key, status, title) => ({ issueId: key, documentId: `uuid-${key}`, status, title });
const OPEN = row("ISS-1", "open", "the criteria write names its grammar before the consult");
const DROPPED = row("ISS-2", "dropped", "criteria -h states the one-outcome rule");
const BARE = row("ISS-3", "dropped", "criteria -h states the citation rule");
const CLOSED = row("ISS-4", "closed", "criteria write refuses a heading line");
const PREFIX = row("ISS-5", "dropped", "criteria -h states the wrap rule");
const REFUSED = row("ISS-6", "dropped", "criteria -h states the numbering rule");
const ROWS = [OPEN, DROPPED, BARE, CLOSED, PREFIX, REFUSED];

const fence = (kind, lines) => `## ${kind}\n\n\`\`\`forge-record\n${lines.join("\n")}\n\`\`\`\n\n\`forge-record: ${kind.toLowerCase()} · contract 1\``;
const comment = (at, body) => ({ documentId: `c-${at}`, createdAt: `2026-09-${at}T00:00:00Z`, body });

const state = {
  issues: ROWS,
  comments: {
    [DROPPED.documentId]: [
      comment("10", fence("Confirmation", ["is: the same defect ISS-9 reports", "where: ISS-9", "finding: duplicate"])),
      comment("11", fence("Park", ["kind: dropped", "why: Duplicate of ISS-9, whose body carries both measurements.", "left: confirmed"])),
    ],
    [BARE.documentId]: [comment("12", "A plain note that says nothing about why.")],
  },
  calls: [],
  memory: {},
  answer: {},
};
const tracker = await fakeTracker(state);
projectRecord(new URL("../../../../", import.meta.url).pathname, tracker.env.XDG_CONFIG_HOME, OWN);
test.after(() => tracker.close());
process.env.XDG_CONFIG_HOME = tracker.env.XDG_CONFIG_HOME;

const { FOLD_FLOOR, foldOnto, neighboursOf, suggestionLines } =
  await import("../../../src/tracker/filing/neighbours.mjs");
const { REASON_MAX, reasonOf, settledOf } = await import("../../../src/tracker/filing/settled.mjs");
const { openTitles } = await import("../../../src/tracker/issue-shape.mjs");

/* The page served for one thread: a prefix for PREFIX, a refusal for REFUSED, the held rows otherwise. */
state.answer.forge_comments = (args) => {
  const id = args.filters?.issue;
  if (id === PREFIX.documentId) return { comments: [], returned: 0, hasMore: true, nextCursor: null };
  if (id === REFUSED.documentId) return { refused: "the thread store is down" };
  return undefined;
};

const measured = (memory, rows = ROWS) => {
  state.memory = memory;
  state.calls = [];
  return neighboursOf({ seed: "criteria -h states what the write refuses", place: "forge record criteria" },
    openTitles(rows), settledOf(rows));
};

const lines = async (memory) => suggestionLines(await measured(memory)).join("\n");

test("settled rows are the dropped and the closed ones, and an open row is none of them", () => {
  assert.deepEqual(settledOf(ROWS).map((one) => one.issueId), ["ISS-2", "ISS-3", "ISS-4", "ISS-5", "ISS-6"]);
});

test("a dropped neighbour at the floor is printed in its own block, apart from the open one", async () => {
  const said = await lines({ semantic: [[OPEN.issueId, 0.76], [DROPPED.issueId, 0.84]], keyword: [] });
  const [openAt, droppedAt] = [said.indexOf("Open beside this filing"), said.indexOf("Filed before and dropped")];
  assert.ok(openAt >= 0 && droppedAt > openAt, said);
  assert.match(said, /^ {2}ISS-2 {4}0\.84 {14}criteria -h states the one-outcome rule$/mu);
  assert.doesNotMatch(said.slice(openAt, droppedAt), /ISS-2/u, "the open block holds no settled row");
});

test("a dropped neighbour carries the latest reason its own record gives", async () => {
  const said = await lines({ semantic: [[DROPPED.issueId, 0.84]], keyword: [] });
  assert.match(said, /^ {4}why: Duplicate of ISS-9, whose body carries both measurements\.$/mu,
    "the park written after the confirmation is the reason, not the confirmation before it");
});

test("each of the three records a drop goes through is read for its reason", () => {
  const park = fence("Park", ["kind: dropped", "why: parked away", "left: open"]);
  const moved = fence("Correction", ["moved: the status set to `dropped` by `forge advance --set`, from `open`", "why: set by hand"]);
  const confirmed = fence("Confirmation", ["is: the premise is false", "where: a.mjs", "finding: premise-false"]);
  assert.equal(reasonOf([comment("01", park)]), "parked away");
  assert.equal(reasonOf([comment("01", moved)]), "set by hand");
  assert.equal(reasonOf([comment("01", confirmed)]), "premise-false: the premise is false");
  const holds = fence("Confirmation", ["is: it is real", "where: a.mjs", "finding: holds"]);
  const other = fence("Park", ["kind: paused", "why: later", "left: open"]);
  assert.equal(reasonOf([comment("01", holds), comment("02", other)]), null,
    "a confirmation that holds and a park of another kind say no drop");
});

test("a reason past the cap is cut on a word and says it was cut", () => {
  const long = Array.from({ length: 80 }, (unused, at) => `word${at}`).join(" ");
  const said = reasonOf([comment("01", fence("Park", ["kind: dropped", `why: ${long}`, "left: open"]))]);
  assert.ok([...said].length <= REASON_MAX + 1, said);
  assert.match(said, /word\d+…$/u);
});

test("a dropped neighbour whose whole thread gives no reason is printed saying so", async () => {
  const said = await lines({ semantic: [[BARE.issueId, 0.8]], keyword: [] });
  assert.match(said, /^ {2}ISS-3 .*\n {4}why: its record gives no reason$/mu);
});

test("a thread served as a prefix leaves the reason unread rather than absent", async () => {
  const said = await lines({ semantic: [[PREFIX.issueId, 0.8]], keyword: [] });
  assert.match(said, /^ {4}why: unread — its thread did not come back whole$/mu);
  assert.doesNotMatch(said, /gives no reason/u);
});

test("a thread the tracker refused leaves the reason unread and the reading still answers", async () => {
  const beside = await measured({ semantic: [[REFUSED.issueId, 0.8]], keyword: [] });
  assert.equal(beside.dropped.length, 1, "the refusal cost the neighbour its reason, not its row");
  assert.match(suggestionLines(beside).join("\n"), /^ {4}why: unread — its thread could not be read: .*the thread store is down/mu);
});

test("the dropped block ends on what a filer answers before filing that subject again", async () => {
  const said = await lines({ semantic: [[DROPPED.issueId, 0.84]], keyword: [] });
  assert.match(said.split("\n").at(-1),
    /^No dropped neighbour takes a finding, and nothing folded onto one\. Where this filing is that subject, the reason is what to answer before filing it again/u);
});

test("a closed neighbour is printed as fixed and landed, a regression or a different defect", async () => {
  const said = await lines({ semantic: [[CLOSED.issueId, 0.81]], keyword: [] });
  assert.match(said, /^Filed before and closed, which means fixed and landed — so this filing is a regression of that fix or a different defect, and saying which is this filing's work:\n {2}ISS-4 {4}0\.81/mu);
  assert.doesNotMatch(said, /ISS-4 .*\n {4}why:/u, "a closed row reads no thread");
  const read = state.calls.filter((one) => one.name === "forge_comments");
  assert.equal(read.length, 0, "and asks the tracker for none");
});

test("a settled neighbour is no fold, whatever it scores and whatever place it names", async () => {
  const beside = await measured({
    semantic: [[DROPPED.issueId, 0.95], [CLOSED.issueId, 0.93]],
    keyword: [[DROPPED.issueId, 0.4], [CLOSED.issueId, 0.4]],
  });
  assert.ok(beside.dropped[0].score >= FOLD_FLOOR && beside.dropped[0].samePlace);
  assert.ok(beside.closed[0].samePlace, "the place is marked on a settled row as on an open one");
  assert.equal(beside.suggestions.length, 0, "neither is a suggestion");
  assert.equal(foldOnto(beside.suggestions), null);
});

test("a settled hit under the floor is not shown", async () => {
  const beside = await measured({ semantic: [[DROPPED.issueId, 0.69]], keyword: [] });
  assert.deepEqual([beside.dropped, beside.closed], [[], []]);
});

test("nothing open beside a settled neighbour says it was filed before, not that nothing was found", async () => {
  const said = await lines({ semantic: [[DROPPED.issueId, 0.84]], keyword: [] });
  assert.match(said.split("\n")[0],
    /^Nothing open reads like this filing or names `forge record criteria` — but it was filed before, and settled:$/u);
  assert.doesNotMatch(said, /found none/u);
});

test("nothing open or settled beside a filing says nothing was filed before", async () => {
  const said = await lines({ semantic: [], keyword: [] });
  assert.match(said, /^Nothing filed before reads like this filing, open or settled, and nothing open names `forge record criteria` — /u);
  assert.equal(said.split("\n").length, 1, "and it is the whole block");
});

test("a caller passing no settled rows measures open against open", async () => {
  state.memory = { semantic: [[DROPPED.issueId, 0.9], [OPEN.issueId, 0.8]], keyword: [] };
  const beside = await neighboursOf({ seed: "x", place: null }, openTitles(ROWS));
  assert.deepEqual([beside.dropped, beside.closed], [[], []]);
  assert.deepEqual(beside.suggestions.map((one) => one.issueId), ["ISS-1"]);
});
