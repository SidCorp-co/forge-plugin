/* The mark has no commit field, so the commit a change landed as lives in its note — and so does
   the head a run judged, once a landing that moved none of the change's paths stopped costing a
   verdict per criterion (ISS-156). One file for the note's grammar and for every record measured
   against it. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("merged-mark").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { CHECKS, viewFrom } = await import("../../../src/flow/earned.mjs");
const { sameCommit } = await import("../../../src/tracker/evidence.mjs");
const { judgedHead, landingMoved, landingWrote, markedCommit } = await import("../../../src/flow/record/merged.mjs");
const { partFor, partsOf, readContract } = await import("../../../src/guides/contract.mjs");
const { kindHelp } = await import("../../../src/flow/record/record-rows.mjs");

let clock = 0;
const at = () => `2026-09-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body, extra = {}) => ({ createdAt: at(), authorId: "agent", body, ...extra });
const recorded = (kind, fields, status = null) => comment(render(kind, fields, status));
const mark = (note) => comment(`mark_merged target=base — ${note}`);

const CRITERIA = "1. The first outcome.\n2. The second outcome.";
/* Evidence is judged against what the issue really carries, so the fixture carries it. */
const ATTACHED = [{ name: "run.txt" }];
const view = (issue, comments = []) => viewFrom("the-uuid", issue, comments);
const missing = (status, one) => CHECKS[status](one, "ISS-3").map((item) => item.what);
const commands = (status, one) => CHECKS[status](one, "ISS-3").map((item) => item.command);

test("a seven-digit commit and the same forty-digit commit are one commit", () => {
  const full = "c8c3550c1b7e1a3f4d5e6f708192a3b4c5d6e7f8";
  assert.ok(sameCommit("c8c3550", full), "the shorter one decides the width");
  assert.ok(sameCommit(full, "C8C3550"), "and case is not part of a sha");
  assert.ok(!sameCommit("c8c3550", "43b811e"));
  assert.ok(!sameCommit("c8c35", "c8c3550"), "under seven digits names nothing");
  assert.ok(!sameCommit(undefined, full));
});

test("the merged commit is read out of the mark's note, because the mark has no commit field", () => {
  const comments = [mark("merged to master at c8c3550 (fast-forward); reviewed head c8c3550")];
  assert.equal(markedCommit(comments), "c8c3550");
  assert.equal(markedCommit([mark("merged to master")]), null, "a note naming no commit earns nothing");
  assert.equal(markedCommit([]), null);
  assert.equal(markedCommit([comment("just a comment at all")]), null, "only the mark's own note is read");
  const twice = [...comments, mark("merged to master at 43b811e")];
  assert.equal(markedCommit(twice), "43b811e", "the latest mark is the one that landed");
});

test("developed needs the mark, its commit, and an approving review of that commit", () => {
  const review = (commit, outcome = "approved") =>
    recorded("review", { reviewer: "codex", commit, outcome, finding: ["F1 accepted"] });
  assert.deepEqual(missing("developed", view({})), [
    "no merged mark, so nothing says the change landed",
    "no code review of the head that landed",
  ]);
  assert.match(commands("developed", view({}))[0], /^forge record merged ISS-3 --at /u,
    "the verb that marks a merge, with a flag per clause of the note it writes");
  const stamped = { mergedAt: "2026-09-02T13:49:51.777Z" };
  assert.deepEqual(missing("developed", view(stamped, [mark("merged to master")]))[0],
    "the merged mark names no commit; its note carries it as `at <sha>`");
  const landed = [mark("merged to master at c8c3550; reviewed head c8c3550")];
  assert.deepEqual(missing("developed", view(stamped, [...landed, review("c8c3550")])), []);
  assert.deepEqual(missing("developed", view(stamped, [...landed, review("43b811e")])),
    ["the review judged 43b811e, and the mark names c8c3550 from head c8c3550"]);
  const squashed = [mark("merged to master at c8c3550 (squashed); reviewed head 43b811e")];
  assert.deepEqual(missing("developed", view(stamped, [...squashed, review("43b811e")])), [],
    "a squash moved the hash, and the note kept the head that was reviewed");
  assert.deepEqual(missing("developed", view(stamped, [...landed, review("c8c3550", "changes-requested")])),
    ["the latest review of c8c3550 says changes-requested"]);
  assert.match(commands("developed", view(stamped, landed))[0], /--commit c8c3550 --outcome approved/u,
    "the commit the review owes is the one the mark named");
});

test("tested needs one verdict per criterion, passing, at the merged commit", () => {
  const issue = { acceptanceCriteria: CRITERIA, mergedAt: "2026-09-02T13:49:51.777Z", attachments: ATTACHED };
  const landed = mark("merged to master at c8c3550");
  const verdict = (number, kind, commit = "c8c3550", extra = {}) =>
    recorded("verdict", { criterion: `${number} — text`, verdict: kind, commit, evidence: ["run.txt"], ...extra });
  assert.deepEqual(missing("tested", view({ mergedAt: issue.mergedAt }, [landed])),
    ["the criteria field holds no numbered line, so there is nothing to judge"]);
  const one = view(issue, [landed, verdict(1, "pass")]);
  assert.deepEqual(missing("tested", one), ["criterion 2 has no verdict"]);
  assert.match(commands("tested", one)[0], /--criterion 2 --verdict pass --commit c8c3550/u);
  assert.deepEqual(missing("tested", view(issue, [landed, verdict(1, "pass"), verdict(2, "pass")])), []);
  const failed = verdict(1, "fail", "c8c3550", { why: "the column stayed empty" });
  assert.deepEqual(missing("tested", view(issue, [landed, failed, verdict(2, "pass")])),
    ["criterion 1 failed its verdict"]);
  assert.deepEqual(missing("tested", view(issue, [landed, verdict(1, "fail"), verdict(2, "pass")])),
    ["the verdict on criterion 1 lacks --why, naming what the criterion did instead: a `fail` is what another run acts on"],
    "a fail is what the next run acts on, so what the criterion did instead is asked for at the write");
  assert.deepEqual(missing("tested", view(issue, [landed, verdict(1, "pass", "43b811e"), verdict(2, "pass")])),
    ["the verdict on criterion 1 judged 43b811e, and the merged commit is c8c3550"]);
  assert.deepEqual(missing("tested", view(issue, [landed, verdict(1, "skipped", "c8c3550", { why: "no screen" }), verdict(2, "pass")])),
    [], "a skip with its reason is judged");
  assert.deepEqual(missing("tested", view(issue, [landed, verdict(1, "skipped"), verdict(2, "pass")])),
    ["the verdict on criterion 1 lacks --why, for a skipped check"], "the shape says what a skip owes");
});

/* Four runs on 2026-09-04 re-posted every verdict after their ship, one of them twenty-eight records
   where fourteen carried the meaning (ISS-156). Each rule below is one of those re-posts. */
test("a verdict at the judged head stands where the landing moved none of the change's paths", () => {
  const issue = { acceptanceCriteria: CRITERIA, mergedAt: "2026-09-02T13:49:51.777Z", attachments: ATTACHED };
  const at = (note) => mark(`merged to master at 9a4d36d; ${note}`);
  const verdicts = [1, 2].map((number) =>
    recorded("verdict", { criterion: `${number} — text`, verdict: "pass", commit: "bc40edc", evidence: ["run.txt"] }));
  const owed = (note) => missing("tested", view(issue, [at(note), ...verdicts]));

  assert.deepEqual(owed("judged head bc40edc; landing moved nothing of this change"), [],
    "the version commit moved no path of the change, so both verdicts stand");
  assert.deepEqual(owed("judged head bc40edc; landing moved nothing"), [], "the bare wording says the same");
  assert.deepEqual(owed("judged head bc40edc; landing moved docs/a.md, plugin/src/flow/earned.mjs"),
    ["the landing moved docs/a.md, plugin/src/flow/earned.mjs, which this change touched, so the "
      + "verdicts on criterion 1, 2 judged bc40edc and the evidence was taken before those paths moved"],
    "one item for the set, because a path list per criterion is what a run reads past");
  assert.match(commands("tested", view(issue, [at("judged head bc40edc; landing moved docs/a.md"), ...verdicts]))[0],
    /--criterion <n> --verdict pass --commit 9a4d36d/u, "and the re-judging is at the landed head");
  assert.deepEqual(owed("judged head bc40edc"),
    ["the verdicts on criterion 1, 2 judged bc40edc, which the mark names as the judged head, and "
      + "the mark says nothing about what the landing moved, so nothing says those verdicts survived it"]);
  assert.match(commands("tested", view(issue, [at("judged head bc40edc"), ...verdicts]))[0],
    /^forge record merged ISS-3 .*--moved <the paths of this change the landing moved>/su,
    "a second mark is the route, and the clause it is owed for is one of the verb's own flags");

  /* Every mark on the tracker today names no judged head, so the old refusal is what they must get. */
  assert.deepEqual(owed("reviewed head 37a0ffb"), [
    "the verdict on criterion 1 judged bc40edc, and the merged commit is 9a4d36d",
    "the verdict on criterion 2 judged bc40edc, and the merged commit is 9a4d36d",
  ], "no judged head clause, so nothing is excused");
  const other = recorded("verdict", { criterion: "2 — text", verdict: "pass", commit: "43b811e", evidence: ["run.txt"] });
  assert.deepEqual(missing("tested", view(issue, [at("judged head bc40edc; landing moved nothing"), verdicts[0], other])),
    ["the verdict on criterion 2 judged 43b811e, and the merged commit is 9a4d36d"],
    "the escape is the judged head and no other hash");
});

test("the mark's note answers for the judged head and what the landing moved", () => {
  const note = (text) => [mark(`merged to master at 9a4d36d; ${text}`)];
  assert.equal(judgedHead(note("judged head bc40edc; landing moved nothing")), "bc40edc");
  assert.equal(markedCommit(note("judged head bc40edc")), "9a4d36d", "the landed hash is still the first `at`");
  assert.equal(judgedHead(note("reviewed head 37a0ffb")), null, "and reviewed is not judged");
  assert.equal(judgedHead([]), null);
  assert.deepEqual(landingMoved(note("landing moved nothing of this change")), []);
  assert.deepEqual(landingMoved(note("landing moved nothing this change touched")), [], "any `nothing` is none");
  assert.deepEqual(landingMoved(note("landing moved a.md, b/c.mjs")), ["a.md", "b/c.mjs"]);
  assert.deepEqual(landingMoved(note("landing moved a.md; reviewed head 37a0ffb")), ["a.md"],
    "the clause ends where the next one starts, since a path list is the one clause with commas");
  assert.equal(landingMoved(note("judged head bc40edc")), null, "silence and none are different answers");
  assert.equal(landingMoved([]), null);
  /* The sentinel is enumerated, because matching it stands every verdict: read loosely, a file
     called `nothing.md` would excuse every verdict the landing moved it under. */
  assert.deepEqual(landingMoved(note("landing moved nothing.md")), ["nothing.md"]);
  assert.deepEqual(landingMoved(note("landing moved nothing/generated.json")), ["nothing/generated.json"]);
  assert.deepEqual(landingMoved(note("landing moved nothingness")), ["nothingness"]);
  assert.deepEqual(landingMoved(note("landing moved nothing generated")), ["nothing generated"]);
  assert.deepEqual(landingMoved(note("landing moved nothing except src")), ["nothing except src"],
    "a hedge is not the sentinel either, and refusing on it is the safe direction");
  /* A clause that parses to no path says nothing, not none: read as none it would stand every
     verdict off a note whose author typed a separator and no path. */
  assert.equal(landingMoved(note("landing moved ,")), null);
  assert.equal(landingMoved(note("landing moved , ,")), null);
});
/* A rung no actor may reach is a rung the flow does not have (ISS-607): four runs on one real state
   recorded four statuses, because this repository earned `developed` by a merge the run itself had to
   make and a run a project binds not to merge cannot write that truthfully. The note's two heads are
   what the stage may read and the writer is what it may not, and the text is what this case reads —
   no check can refuse a field the view has no key for, and the writer is exactly that field. */
test("the mark's writer decides nothing: `developed` is earned by the note, whichever actor landed", () => {
  const parts = partsOf(readContract());
  const developed = partFor(parts, "developed").text;
  assert.match(developed, /Whichever actor landed the change writes the mark/u,
    "the developed stage does not say the landing may be another actor's, so a builder bound not to "
    + "merge reads a rung it cannot earn and picks some other status instead");
  assert.match(developed, /Nothing in this stage reads who wrote the mark,\s+and nothing may/u,
    "and it does not say the writer goes unread, which is the half a second actor needs to write the mark");
  /* The heads are what the writer owes in its place, and the clause that carries each is the mark's
     own usage: a note naming neither leaves every verdict owed at the merged commit, and the
     shortfall that says so is `mergedForm`'s. The contract states the boundary and not the clauses. */
  const owed = kindHelp("merged");
  for (const [flag, label] of [["--judged", "the head the verdicts judged"], ["--at", "the sha the change landed at"]]) {
    assert.ok(owed.includes(flag) && owed.includes(label),
      `\`forge record merged -h\` stops naming ${flag}, and the note is what binds the verdicts once the writer goes unread`);
  }
  assert.doesNotMatch(developed, /judged head/u, "and the contract does not restate the clause the "
    + "usage names: one home per clause, or the note's form has two and the copy nobody corrects is the prose");
});

/* The claim above, read off the code: the mark and the verdicts carry different authors and every
   check earns alike, because no reader keys on one. Regression coverage — it holds before the clause. */
test("a mark one actor wrote earns developed for verdicts another wrote", () => {
  const note = "merged to master at 9a4d36d; judged head 9a4d36d; landing moved nothing";
  const by = (who, body) => ({ ...comment(body), authorId: who });
  const landed = by("the-lander", `mark_merged target=base — ${note}`);
  const review = { ...recorded("review", { reviewer: "codex", commit: "9a4d36d", outcome: "approved",
    finding: ["F1 accepted"] }), authorId: "the-builder" };
  const issue = { mergedAt: "2026-09-02T13:49:51.777Z", acceptanceCriteria: CRITERIA,
    plan: "", attachments: ATTACHED };
  assert.deepEqual(missing("developed", view(issue, [landed, review])), [],
    "the lander wrote the mark and the builder the review, and developed reads neither author");
  const verdicts = [1, 2].map((number) => ({ ...recorded("verdict", { criterion: `${number}. one`,
    verdict: "pass", commit: "9a4d36d", evidence: ["run.txt"] }), authorId: "the-builder" }));
  assert.deepEqual(missing("tested", view(issue, [landed, review, ...verdicts])), [],
    "and tested judges the verdicts at the head the note names, not against whoever marked the merge");
});

/* Two clauses, two questions: what other commits moved under this change, and what this change
   itself wrote. A note carrying both is read as both, and neither answer comes off the other. */
test("the note says what this change wrote beside what the landing moved under it", () => {
  const note = (text) => [mark(`merged to master at 9a4d36d; ${text}`)];
  assert.deepEqual(landingWrote(note("landing wrote a.md, b/c.mjs")), ["a.md", "b/c.mjs"]);
  assert.deepEqual(landingWrote(note("landing wrote nothing")), []);
  assert.equal(landingWrote(note("landing moved a.md")), null, "the other clause answers nothing here");
  assert.equal(landingWrote([]), null);
  const both = note("landing moved a.md; landing wrote b.mjs, c.mjs");
  assert.deepEqual(landingMoved(both), ["a.md"]);
  assert.deepEqual(landingWrote(both), ["b.mjs", "c.mjs"]);
  assert.equal(landingWrote(note("landing wrote ,")), null, "a clause that parses to no path says nothing");
});
