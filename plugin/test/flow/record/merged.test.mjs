/* The verb that hangs the merged mark and the one route back, end to end against a tracker: the note
   is prose on the wire and every clause of it is read back by a later status, so what this watches is
   that the five flags compose a note the readers parse and that a clause left out is refused rather
   than written as a gap nobody can see. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("record-merged").path;
const {
  judgedHead, landingMoved, landingWrote, lastMark, markNote, markedCommit, reviewedHead,
} = await import("../../../src/flow/record/merged.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const AT = "c8c3550c1b7e1a3f4d5e6f708192a3b4c5d6e7f8";
const REVIEWED = "43b811e0000000000000000000000000000000ab";
const JUDGED = "bc40edc0000000000000000000000000000000cd";

let clock = 0;
const stamped = () => `2026-09-08T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;

const ISSUE = {
  documentId: "merged-uuid",
  issueId: "ISS-99",
  status: "in_progress",
  title: "the change whose landing is marked by a verb",
  description: "`forge dep` should take the `data.relations` route.",
  complexity: "s",
};

const state = {
  calls: [],
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
      if (args.action === "get") return ISSUE;
      if (args.action === "update") return Object.assign(ISSUE, args.data);
      /* The tracker's own audit comment for either direction, which is where the note is read from. */
      if (args.action === "mark_merged") {
        (state.comments[args.data.issueId] ??= []).push({
          documentId: `mark-${clock + 1}`,
          createdAt: stamped(),
          authorId: "agent",
          body: `mark_merged target=${args.data.target} — ${args.data.note}`,
        });
        return { ...ISSUE, mergedAt: stamped() };
      }
      if (args.action === "unmark") {
        state.comments[args.data.issueId] = [];
        return { ...ISSUE, mergedAt: null };
      }
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        const one = { documentId: `c-${clock + 1}`, createdAt: stamped(), authorId: "agent", body: args.data.body };
        (state.comments[args.data.issue] ??= []).push(one);
        return { documentId: one.documentId };
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
await ranAsync(FORGE, ["claim", "ISS-99"], tracker.env);

const marked = (...argv) => ranAsync(FORGE, ["record", "merged", "ISS-99", ...argv], tracker.env);
const page = () => state.comments[ISSUE.documentId] ?? [];
const whole = (over = []) => [
  "--at", AT, "--reviewed", REVIEWED, "--judged", JUDGED,
  "--moved", "docs/a.md, plugin/src/flow/earned.mjs", "--wrote", "plugin/src/flow/record/merged.mjs",
  ...over,
];

test("the five flags compose the note, and every reader of it parses what they wrote", async () => {
  state.comments[ISSUE.documentId] = [];
  const run = await marked(...whole());
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, new RegExp(`^ISS-99 {2}marked merged at ${AT}\\. Its note:$`, "mu"),
    "the reply says which commit it marked, off the flag it was given");
  const sent = state.calls.find((one) => one.args.action === "mark_merged");
  assert.equal(sent.args.data.target, "base", "the target a landing takes, no flag having named another");
  const held = page();
  assert.equal(markedCommit(held), AT, "the commit `developed` reads");
  assert.equal(reviewedHead(held), REVIEWED, "the head the review is measured against");
  assert.equal(judgedHead(held), JUDGED, "the head the verdicts are measured against");
  assert.deepEqual(landingMoved(held), ["docs/a.md", "plugin/src/flow/earned.mjs"]);
  assert.deepEqual(landingWrote(held), ["plugin/src/flow/record/merged.mjs"]);
  assert.match(lastMark(held), /merged to master at /u, "and the branch it landed on opens the note");
});

/* A clause is a sha in a slot another status reads for a different one, so a note is composed whole
   or not at all: naming one missing flag at a time costs a round per clause. */
test("every clause left out is named at once, and nothing is written for a note with a hole in it", async () => {
  state.comments[ISSUE.documentId] = [];
  state.calls = [];
  const run = await marked("--at", AT);
  assert.equal(run.status, 1, run.stdout);
  /* The line itself, not the usage under it: every flag appears there whether it was owed or not, so
     matching the whole output would pass a refusal that named one clause per round. */
  const [owed] = run.stderr.split("\n").filter((one) => one.includes("record merged needs"));
  assert.equal(owed, "record merged needs --reviewed, --judged, --moved, --wrote, which are clauses of the mark's note and have no default:",
    "the four left out, all of them, on the line that says what is owed");
  assert.equal(state.calls.some((one) => one.args.action === "mark_merged"), false, "and no mark went up");
  assert.deepEqual(page(), [], "nor an audit comment for one");
});

/* The note's clauses are joined by `;`, so a path holding one is read back as its clause ending
   there: `moved` with one path in it would read as none moved, which is the reading `tested` acts
   on. Refused at the composer, which is also where the landing task builds its note. */
test("a path that cannot survive the note's own separator is refused, and nothing is written", async () => {
  state.comments[ISSUE.documentId] = [];
  state.calls = [];
  const run = await marked("--at", AT, "--reviewed", REVIEWED, "--judged", JUDGED,
    "--moved", "nothing; plugin/src/a.mjs", "--wrote", "nothing");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /cannot travel in the mark's note/u);
  assert.match(run.stderr, /separated by `;`/u, "and why, which is what tells the run what to write instead");
  assert.equal(state.calls.some((one) => one.args.action === "mark_merged"), false);
  assert.deepEqual(page(), []);
});

/* The landing task hands the composer path arrays of its own, where a value the flag route would
   have split or read as the word for none arrives whole. Judged at `markNote`, which is the call
   both of them make. */
test("a path the reader could not tell from the word for none is refused by the composer", () => {
  const whole = { branch: "master", at: AT, reviewed: REVIEWED, judged: JUDGED, wrote: [] };
  const note = (moved) => () => markNote({ ...whole, moved });
  assert.throws(note(["nothing"]), /is the word this clause takes for no paths at all/u,
    "a path called `nothing` would read back as a landing that moved none");
  assert.throws(note(["nothing."]), /is the word this clause takes for no paths at all/u);
  assert.throws(note(["plugin/src/a,b.mjs"]), /separated by `;`/u, "and a comma is what the paths of one clause are apart by");
  assert.match(markNote({ ...whole, moved: ["plugin/src/a.mjs", "docs/b.md"] }),
    /landing moved plugin\/src\/a\.mjs, docs\/b\.md;/u, "while the paths a landing really moves travel as they are");
});

/* A clause is found by its own words wherever they fall in the note, so a path carrying another
   clause's words is read as that clause: the reader reaches the words inside the path first and
   the clause they belong to reads as whatever follows them. No separator is involved, so the
   composer's own read-back is the only thing that catches it. */
test("a path carrying another clause's words is refused, because the note would not read back", () => {
  const whole = { branch: "master", at: AT, reviewed: REVIEWED, judged: JUDGED };
  assert.throws(() => markNote({ ...whole, moved: ["plugin/src/landing wrote nothing.mjs"], wrote: ["plugin/src/new.mjs"] }),
    /does not read back/u, "the note would say the landing wrote nothing where it wrote a file");
  assert.throws(() => markNote({ ...whole, moved: ["plugin/src/landing wrote nothing.mjs"], wrote: ["plugin/src/new.mjs"] }),
    /`landing wrote` clause reads as nothing\.mjs where plugin\/src\/new\.mjs was given/u,
    "and the refusal names the clause, what it read and what was given");
  assert.match(markNote({ ...whole, moved: ["plugin/src/a.mjs"], wrote: ["plugin/src/new.mjs"] }),
    /landing wrote plugin\/src\/new\.mjs$/u, "while a note that reads back as given is written");
});

test("a clause naming nothing is written as that word, and reads back as no paths", async () => {
  state.comments[ISSUE.documentId] = [];
  const run = await marked("--at", AT, "--reviewed", REVIEWED, "--judged", JUDGED,
    "--moved", "nothing", "--wrote", "nothing");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(landingMoved(page()), [], "a landing that moved none of the change's paths says so");
  assert.deepEqual(landingWrote(page()), []);
  assert.equal(markedCommit(page()), AT, "and the shas beside it are read as they were written");
});

test("a value that is no commit is refused by the clause that wanted one", async () => {
  state.comments[ISSUE.documentId] = [];
  const run = await marked("--at", "master", "--reviewed", REVIEWED, "--judged", JUDGED,
    "--moved", "nothing", "--wrote", "nothing");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--at/u, "the flag it came in on is what the refusal names");
  assert.deepEqual(page(), [], "and nothing was written under a clause the readers could not parse");
});

/* Criterion 6: the marks already on the tracker were written before the verb existed, and a reader
   that only understood the verb's own five clauses would report every one of them as a hole. */
test("a note written before this verb still answers for the clauses it does carry", () => {
  const old = [{
    documentId: "mark-old",
    createdAt: "2026-09-01T10:00:00.000Z",
    authorId: "agent",
    body: `mark_merged target=base — merged to master at ${AT} (fast-forward); reviewed head ${AT}`,
  }];
  assert.equal(markedCommit(old), AT);
  assert.equal(reviewedHead(old), AT, "the two clauses it has read exactly as they always did");
  assert.equal(judgedHead(old), null, "and the three it does not are absent rather than wrong");
  assert.equal(landingMoved(old), null, "absent, which the checks tell from a clause saying nothing moved");
  assert.equal(landingWrote(old), null);
  const said = [{ ...old[0], body: `${old[0].body}; landing moved nothing; landing wrote nothing` }];
  assert.deepEqual([landingMoved(said), landingWrote(said)], [[], []],
    "and the two readings are apart, or a mark that answered would read as one that never spoke");
});

test("--undo takes the mark down and reads back the note it removed", async () => {
  state.comments[ISSUE.documentId] = [];
  assert.equal((await marked(...whole())).status, 0);
  state.calls = [];
  const run = await marked("--undo");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /the merged mark is removed\. What it said:/u);
  assert.match(run.stdout, new RegExp(`merged to master at ${AT}`, "u"),
    "the note goes back to whoever removed it, that being the only copy of what it claimed");
  assert.ok(state.calls.some((one) => one.args.action === "unmark"), "the route back is its own action");
  assert.equal(markedCommit(page()), null, "and the mark is gone from the page");
});

test("--undo on an issue carrying no mark refuses with the form a mark is written in", async () => {
  state.comments[ISSUE.documentId] = [];
  state.calls = [];
  const run = await marked("--undo");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /carries no merged mark, so there is nothing to remove/u);
  assert.match(run.stderr, /forge record merged ISS-99 --at /u, "and the route on is the verb's own line");
  assert.equal(state.calls.some((one) => one.args.action === "unmark"), false);
});

test("--undo beside a clause is refused, a removal writing none of them", async () => {
  const run = await marked("--undo", "--at", AT);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--undo removes the mark whole/u);
  assert.match(run.stderr, /--at has no place beside it/u, "naming the flag that has no place there");
});

test("a flag this verb has no clause for is refused with the ones it has", async () => {
  const run = await marked("--commit", AT);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /No record merged flag named --commit\./u);
  assert.match(run.stderr, /--at V --reviewed V --judged V --moved V --wrote V \[--to B\] \| --undo/u,
    "the set, so a run reaching for a name this verb does not have is told the ones it does");
});

/* The branch is a clause of the note like the shas, and this project's own config is where it comes
   from: a note naming the wrong branch says the change landed somewhere it did not. */
test("a project whose config names no base branch is refused, and told the flag that names one", async () => {
  state.comments[ISSUE.documentId] = [];
  const held = state.config;
  state.config = { productionBranch: "master", pipelineConfig: { autoProdDeploy: false } };
  try {
    const run = await marked(...whole());
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /this project's config names no base branch/u);
    assert.match(run.stderr, /--to <branch>/u);
    const named = await marked(...whole(["--to", "release-1"]));
    assert.equal(named.status, 0, `${named.stdout}${named.stderr}`);
    assert.match(lastMark(page()), /merged to release-1 at /u, "and the branch named by hand is the one written");
  } finally {
    state.config = held;
  }
});
