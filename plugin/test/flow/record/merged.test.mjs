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
const { capsOf, lengthOf } = await import("../../../src/tracker/field-write.mjs");

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
  description: "`forge issue` should take the `data.relations` route.",
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
await ranAsync(FORGE, ["claim", "ISS-99", "--unheld"], tracker.env);

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
  assert.throws(note(["nothing", "plugin/src/a.mjs"]), /beside another path it says both and so neither/u,
    "and beside a path it is a clause saying both (ISS-1023)");
  assert.throws(note(["plugin/src/a,b.mjs"]), /separated by `;`/u, "and a comma is what the paths of one clause are apart by");
  assert.match(markNote({ ...whole, moved: ["plugin/src/a.mjs", "docs/b.md"] }),
    /landing moved plugin\/src\/a\.mjs, docs\/b\.md;/u, "while the paths a landing really moves travel as they are");
});

/* Whitespace is what the flag route bars, and it is barred there and not here: every clause word the
   note is read by needs a space to collide, so the read-back refusal below would be unreachable for
   a path clause if the composer refused one — and the landing task's paths come off `git diff`. */
test("a path holding a space composes, the landing task's own route asking no flag for it", () => {
  const whole = { branch: "master", at: AT, reviewed: REVIEWED, judged: JUDGED, wrote: [] };
  assert.match(markNote({ ...whole, moved: ["docs/a note.md"] }),
    /landing moved docs\/a note\.md;/u, "a path a tree really holds a space in travels as it is");
});

/* The ship prints the clause the note carries and the run types it into the flag, so the note's own
   wording lands in the value: the mark then says a landing moved a file of that name, and
   `awaiting_release` stands every verdict down against a path nothing wrote (ISS-1023). */
test("a phrase typed into a path clause is refused under the flag it came in on, and nothing is written", async () => {
  state.comments[ISSUE.documentId] = [];
  state.calls = [];
  const run = await marked("--at", AT, "--reviewed", REVIEWED, "--judged", JUDGED,
    "--moved", "landing moved nothing", "--wrote", "plugin/src/a.mjs");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^--moved takes the paths of this change the landing moved/mu,
    "the flag the value was typed on opens the refusal");
  assert.match(run.stderr, /`landing moved nothing` holds whitespace/u, "and names what it read as no path");
  assert.match(run.stderr, /`landing moved` is the note's own wording rather than part of the value/u,
    "and which words of the printed clause were the template");
  assert.match(run.stderr, /which here is `nothing`/u, "and what the flag would have taken instead");
  assert.equal(state.calls.some((one) => one.args.action === "mark_merged"), false);
  assert.deepEqual(page(), []);
});

test("prose quoting no clause is refused on the other path flag, told what a path may hold", async () => {
  state.comments[ISSUE.documentId] = [];
  state.calls = [];
  const run = await marked("--at", AT, "--reviewed", REVIEWED, "--judged", JUDGED,
    "--moved", "nothing", "--wrote", "probably nothing");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^--wrote takes the paths this change itself landed/mu, "in its own name");
  assert.match(run.stderr, /Name a path that really holds a space by the directory it is under/u,
    "and with the one route out, no clause of the note being quoted here");
  assert.deepEqual(page(), []);
});

test("the word for none typed beside a path is refused, and nothing is written", async () => {
  state.comments[ISSUE.documentId] = [];
  state.calls = [];
  const run = await marked("--at", AT, "--reviewed", REVIEWED, "--judged", JUDGED,
    "--moved", "nothing, plugin/src/a.mjs", "--wrote", "nothing");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /beside another path it says both and so neither/u);
  assert.equal(state.calls.some((one) => one.args.action === "mark_merged"), false);
  assert.deepEqual(page(), []);
});

/* The clause records what the landing wrote and asks nothing of the filesystem: a path a later
   commit deleted, and a path no tree ever held, are both what this change landed. */
test("a path no tree holds is written and reads back as given", async () => {
  state.comments[ISSUE.documentId] = [];
  const run = await marked("--at", AT, "--reviewed", REVIEWED, "--judged", JUDGED,
    "--moved", "nothing", "--wrote", "plugin/src/flow/gone.mjs, docs/cli/never-was.md");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(landingWrote(page()), ["plugin/src/flow/gone.mjs", "docs/cli/never-was.md"],
    "both paths, in the order they were typed, whatever the tree holds");
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

/* ISS-730's fixture, and the shape ISS-673 landed with: 119 paths whose whole list is some 4700 code
   points, of which the plan names the last 90. The note cannot carry them all, and what it keeps is
   chosen rather than cut — every path the plan does not name is what `developed` reads. */
const CASES = Array.from({ length: 119 },
  (_, at) => `plugin/src/flow/record/case-${String(at).padStart(3, "0")}.mjs`);
const OWED = CASES.slice(0, 29);
const PLANNED = CASES.slice(29).join("\n");
const fixture = (over = {}) =>
  markNote({ branch: "master", at: AT, reviewed: REVIEWED, judged: JUDGED, moved: [], wrote: CASES,
    named: PLANNED, ref: "ISS-99", ...over });

test("a change of 119 paths composes a note the tracker takes, and says what it left out", () => {
  const note = fixture();
  const room = capsOf().note.self;
  assert.equal(room, 2000, "the room is the route table's own cap for the field, and no other number");
  assert.ok(lengthOf(note) <= room, `the note is ${lengthOf(note)} code points:\n${note}`);
  const mark = [{ documentId: "m", createdAt: "2026-09-08T10:00:00.000Z", body: `mark_merged — ${note}` }];
  const kept = landingWrote(mark);
  assert.match(note, new RegExp(`holds ${kept.length} of this change's 119 paths and leaves out `
    + `${119 - kept.length} the plan names`, "u"), "the clause standing in for the rest counts both halves");
  assert.match(note, /whole list is the diff of the judged head above against its base/u,
    "and says where the whole list is read from, the note being no longer the record of it");
  assert.deepEqual(landingMoved(mark), [], "while the other path clause reads as it was written");
  assert.equal(markedCommit(mark), AT, "and no word of that clause is taken for a sha");
});

test("every path the plan does not name is in the clause, and the ones it names fill the rest", () => {
  const note = fixture();
  const kept = landingWrote([{ documentId: "m", createdAt: "2026-09-08T10:00:00.000Z", body: `mark_merged — ${note}` }]);
  assert.deepEqual(kept.slice(0, OWED.length), OWED,
    "the 29 the plan names nowhere go in first, or `developed` would pass a change that grew");
  assert.ok(kept.length > OWED.length, "and what room is left goes to the ones it does name");
  assert.ok(kept.every((one) => CASES.includes(one)), "every one of them still a path and none of them cut");
});

/* The correction is the one `developed` asks for in any case, and it is what makes the note fit:
   named there, those paths are ones the composer may leave out. */
test("a note whose unnamed paths alone overrun it is refused, with the correction that clears them", () => {
  assert.throws(() => fixture({ named: "the plan names none of them" }), (error) => {
    assert.match(error.message, /over the 2000 the tracker takes with only the 119 path\(s\) the plan/u);
    assert.match(error.message, /none of them may be left out: nothing was written/u);
    assert.match(error.message, /forge record correction ISS-99 --moved "the change also wrote /u);
    return true;
  });
  assert.ok(lengthOf(fixture({ named: "", wrote: CASES })) <= capsOf().note.self,
    "while a change with no plan at all is read against nothing, so the note may leave any of them out");
});

test("the clause a landing moved is never shortened, and the note that cannot hold it is refused", () => {
  assert.throws(() => fixture({ moved: CASES, named: PLANNED }), (error) => {
    assert.match(error.message, /with the shortest written path in it and no other/u);
    assert.match(error.message, /`landing moved` clause: nothing was written/u);
    assert.match(error.message, /Name the directory those paths are under\./u);
    return true;
  });
});

/* Paths are not one length, and the fitting is measured and not counted: a long one first would
   otherwise refuse a note a short one fits in, and a long one in the middle would end the fill with
   room to spare. */
test("a path the room cannot take is passed over, and the ones it can take go in", () => {
  const wide = `plugin/src/flow/record/${"w".repeat(400)}.mjs`;
  const thin = ["plugin/src/flow/record/thin-one.mjs", "plugin/src/flow/record/thin-two.mjs"];
  const filler = Array.from({ length: 30 },
    (_, one) => `docs/moved/${String(one).padStart(3, "0")}-${"m".repeat(30)}.md`);
  const wrote = [wide, ...thin];
  const note = markNote({ branch: "master", at: AT, reviewed: REVIEWED, judged: JUDGED,
    moved: filler, wrote, named: wrote.join("\n"), ref: "ISS-99" });
  assert.ok(lengthOf(note) <= capsOf().note.self, `${lengthOf(note)} code points:\n${note}`);
  const kept = landingWrote([{ documentId: "m", createdAt: "2026-09-08T10:00:00.000Z", body: `mark_merged — ${note}` }]);
  assert.deepEqual(kept, thin, "the two the room takes, and neither of them the first path given");
  assert.match(note, /holds 2 of this change's 3 paths and leaves out 1 the plan names/u);
  assert.deepEqual(landingMoved([{ documentId: "m", createdAt: "2026-09-08T10:00:00.000Z", body: `mark_merged — ${note}` }]),
    filler, "while every path the landing moved is still named, that clause being the one never shortened");
});

test("the verb itself composes the fitted note, off what the issue's own plan names", async () => {
  state.comments[ISSUE.documentId] = [];
  const run = await marked("--at", AT, "--reviewed", REVIEWED, "--judged", JUDGED,
    "--moved", "nothing", "--wrote", CASES.join(","));
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const note = lastMark(page());
  assert.ok(lengthOf(note) <= capsOf().note.self, `the verb sent ${lengthOf(note)} code points:\n${note}`);
  assert.match(note, /that clause holds \d+ of this change's 119 paths/u);
  assert.ok(landingWrote(page()).length > 0, "and the clause still parses as paths");
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
