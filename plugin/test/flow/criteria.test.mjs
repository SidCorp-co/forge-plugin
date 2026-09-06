/* The criteria grammar `forge record criteria` refuses on, and the corpus that says it refuses no
   more than it can prove (ISS-483). Both halves live here: a shape case reads like a rule and the
   sixty rows read like a fixture, and a run that loosens the rule has to face them together. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("criteria-");
const { compoundCriteria } = await import("../../src/flow/machine.mjs");
const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ask = (...argv) => spawnSync(FORGE, argv, { encoding: "utf8", env: process.env });

/* ISS-474's twenty-seven criteria, ISS-500's sixteen and ISS-445's seventeen, byte for byte as the
   tracker held them at fa41167: the false-refusal oracle, frozen rather than queried because the
   issues go on being edited. Three were found compound by a consult when they were written; the
   other fifty-seven are one claim each and every one has to keep writing. */
const CRITERIA_CORPUS = [
  // ISS-474
  { issue: "ISS-474", number: 1, text: "The simplify reading the issue's first rule asks for is on this issue's thread before the run acted on it." },
  { issue: "ISS-474", number: 2, text: "This run's confirmation cites that reading rather than re-making it." },
  { issue: "ISS-474", number: 3, text: "The hand reading's ground is recorded, and it names the range's files the thirty-three-item list names nowhere." },
  { issue: "ISS-474", number: 4, text: "Every finding this run acted on says which of the two readings raised it." },
  { issue: "ISS-474", number: 5, text: "BR-09~1: exactly one commit of this run's work lands on master." },
  { issue: "ISS-474", number: 6, text: "That commit's message names the range it read." },
  { issue: "ISS-474", number: 7, text: "A reviewer reading that commit at the head it landed at records an approving outcome for BR-09~1 — every fact it moved has one home afterwards." },
  { issue: "ISS-474", number: 8, text: "No file any sibling worktree declares as its own appears in that commit." },
  { issue: "ISS-474", number: 9, text: "Every item of the list that falls on a sibling's file is filed into that sibling's issue, by key, in this run's routed record." },
  { issue: "ISS-474", number: 10, text: "Every item that would change what the code does is filed as an issue naming ISS-474." },
  { issue: "ISS-474", number: 11, text: "No item filed under criterion 10 is also changed by the commit." },
  { issue: "ISS-474", number: 12, text: "Every item refused without a filing carries its reason in this run's record." },
  { issue: "ISS-474", number: 13, text: "`forge stats eval --project <checkout>` prints byte-identical output before and after the commit." },
  { issue: "ISS-474", number: 14, text: "`forge stats runs --project <checkout>` prints byte-identical output before and after the commit." },
  { issue: "ISS-474", number: 15, text: "`forge codex stats` prints byte-identical output before and after the commit." },
  { issue: "ISS-474", number: 16, text: "`forge codex eval` prints byte-identical output before and after the commit, over a window carrying at least one value below the fold threshold on both sides." },
  { issue: "ISS-474", number: 17, text: "`forge -h` prints byte-identical output before and after the commit." },
  { issue: "ISS-474", number: 18, text: "`forge call forge_issues '{\"action\":\"list\"}'` prints byte-identical stderr before and after the commit." },
  { issue: "ISS-474", number: 19, text: "That same invocation exits non-zero after the commit, as it did before it." },
  { issue: "ISS-474", number: 20, text: "`npm run check` is green over the whole tree at the head the review read." },
  { issue: "ISS-474", number: 21, text: "The knowledge store carries a `module-*` entry for every tree this reading read." },
  { issue: "ISS-474", number: 22, text: "Each of those entries was written in this run against what this reading found." },
  { issue: "ISS-474", number: 23, text: "`forge knowledge list` shows no second entry for a tree that already had one." },
  { issue: "ISS-474", number: 24, text: "Each source the project brief reported as moved has a recorded judgement in this run." },
  { issue: "ISS-474", number: 25, text: "`forge project` reports no source as moved unread when the run ends." },
  { issue: "ISS-474", number: 26, text: "`refs/forge/reviewed` names 690eda296eff58c9babb235b3a5c19d0c60f7449 when the run ends." },
  { issue: "ISS-474", number: 27, text: "Every finding raised by a consult on this issue's plan or criteria has a recorded verdict." },
  // ISS-500
  { issue: "ISS-500", number: 1, text: "AC-19-8-7~1: `forge stats runs` prints an `edits` line naming each of the five routes — edit, write, edit heredoc, edit file, edit sed — with the median calls per run and the median characters a call carried, read off the fixture in `plugin/test/stats/runs.test.mjs`." },
  { issue: "ISS-500", number: 2, text: "AC-19-8-7~1: The characters a call carried are read off the call's own input: the shell text for Bash, the old and new text for Edit, the content for Write; a fixture call of each route adds up by hand." },
  { issue: "ISS-500", number: 3, text: "AC-19-8-7~1: `forge stats runs` prints a `ships` line with the passes in all, the median passes per run, the passes resumed with `--from`, and the runs in which a push came back rejected, the last read off the ship's own sentence in any call's result." },
  { issue: "ISS-500", number: 4, text: "AC-19-8-7~1: A `review` call of the ship script is not counted as a pass." },
  { issue: "ISS-500", number: 5, text: "AC-19-8-7~1: Both lines are in `--json` under `edits` and `ships` of the profile." },
  { issue: "ISS-500", number: 6, text: "AC-19-8-7~1: `forge stats eval`'s figure line carries the median ship passes per run and the median edit characters per run for each window." },
  { issue: "ISS-500", number: 7, text: "AC-19-8-7~1: Each route is a class the classifier table declares: the one `edit` row is split into `edit heredoc`, `edit sed` and `edit file`, and the Write tool maps to `write`." },
  { issue: "ISS-500", number: 8, text: "AC-19-8-7~1: No code reads the shell text a second time to name a route; the route is the call's class." },
  { issue: "ISS-500", number: 9, text: "AC-19-8-7~1: The phase-open table test passes with the same outcomes as before this change." },
  { issue: "ISS-500", number: 10, text: "AC-19-8-7~1: The original fixture's pinned rows print unchanged at this head." },
  { issue: "ISS-500", number: 11, text: "AC-19-8-7~1: The original fixture prints `edits` with every route at zero and `ships` with one pass, none resumed and no rejection." },
  { issue: "ISS-500", number: 12, text: "AC-19-8-7~1: `forge guide harness-eval` Phase 3b names the `edits` line and the `ships` line as places to look for room." },
  { issue: "ISS-500", number: 13, text: "AC-19-8-7~1: `docs/cli/stats.md` says what the two lines are, in its classifier section." },
  { issue: "ISS-500", number: 14, text: "AC-19-8-7~1: `docs/cli/stats.md` passes the docs gate's topic cap at this head." },
  { issue: "ISS-500", number: 15, text: "AC-19-8-7~1: Requirement AC-19-8-7 names the rule with the fixture case as its proof, and the requirements gate resolves it." },
  { issue: "ISS-500", number: 16, text: "AC-19-8-7~1: `npm run check` passes whole on the branch at the head the review judges." },
  // ISS-445
  { issue: "ISS-445", number: 1, text: "`forge doctor` prints a session-id line naming its source as one of asked, inherited, saved or minted." },
  { issue: "ISS-445", number: 2, text: "That line, when the id came from `CLAUDE_CODE_SESSION_ID`, states the value is shared by every agent the session dispatched." },
  { issue: "ISS-445", number: 3, text: "That line names `FORGE_SESSION_ID` as what gives one run its own holder id." },
  { issue: "ISS-445", number: 4, text: "`forge resume` on a lease whose holder equals this reader's inherited id says the match is the dispatching session's." },
  { issue: "ISS-445", number: 5, text: "`forge resume` on a lease held by another run's explicit id prints no such disclosure." },
  { issue: "ISS-445", number: 6, text: "`forge claim` under an inherited id that matched the lease prints that disclosure." },
  { issue: "ISS-445", number: 7, text: "`sessionOf()` returns the value it returns today for every combination of the two environment variables and the saved file." },
  { issue: "ISS-445", number: 8, text: "`sessionHeld()` writes no file when no id is held." },
  { issue: "ISS-445", number: 9, text: "A test proves a second run with a distinct holder id is refused its payload write with the live-lease refusal." },
  { issue: "ISS-445", number: 10, text: "A test proves a second run sharing one inherited holder id is not refused that write." },
  { issue: "ISS-445", number: 11, text: "A test proves the disclosure fires at the claim surface for a reader whose inherited id equals the lease's holder." },
  { issue: "ISS-445", number: 12, text: "`node tools/run.mjs start ISS-nn` prints a holder id unique to the worktree it made." },
  { issue: "ISS-445", number: 13, text: "That id is recorded under the worktree's own git directory rather than `~/.config/forge/session.json`." },
  { issue: "ISS-445", number: 14, text: "`node tools/run.mjs start` on a worktree it did not make still refuses to touch it." },
  { issue: "ISS-445", number: 15, text: "That refusal names the id recorded for that worktree." },
  { issue: "ISS-445", number: 16, text: "`npm run check` passes on the branch." },
  { issue: "ISS-445", number: 17, text: "No file the change touches is in the FROZEN set." },
];

/* Each shape the grammar can prove, and beside it the ones it cannot: a let-through line's second
   half is a noun phrase, a condition or a relative clause, and refusing one of those costs a write. */
test("the compound reading refuses a second clause and lets a second noun phrase write", () => {
  const read = (text) => compoundCriteria([{ number: 1, text }], "en");
  const refuses = (text) => assert.equal(read(text).length, 1, `should read two outcomes: ${text}`);
  const writes = (text) => assert.deepEqual(read(text), [], `should stand: ${text}`);
  refuses("An empty list shows the empty state and hides the export.");
  refuses("The hand reading's ground is recorded, and it names the range's files the list names nowhere.");
  refuses("The one `edit` row is split into `edit heredoc`, `edit sed` and `edit file`, and the Write tool maps to `write`.");
  refuses("The list is sorted, and the export is hidden.");
  writes("The refusal names the line and the split it owes.");
  writes("When the list is empty and the filter is set, the export is hidden.");
  writes("The line carries the median calls per run and the median characters a call carried.");
  writes("It prints the passes in all, the median passes per run, and the runs in which a push came back rejected.");
  writes("The record that names the line and carries the split is written once.");
  writes("The route is named read-and-write in the table.");
  writes("The classifier table names `edit and write` as one class.");
  writes("Where the list is empty and the filter is set, nothing is exported.");
  writes("The list and the export are hidden.");
  writes("The rows removed yesterday and the rows removed today are identical.");
  writes("When the list is empty, the cache is cold, and the filter is set, the export is hidden.");
  assert.deepEqual(compoundCriteria([{ number: 1, text: "It shows the state and hides the export." }], "vi"), [],
    "a prose language the table does not carry refuses nothing");
});

/* The oracle the refusal is worth having: sixty criteria this repository wrote before the reading
   existed, of which a consult found three compound. A shape that refuses a fourth costs a write. */
test("the frozen corpus of sixty criteria is read as three compound lines and no more", () => {
  const read = compoundCriteria(CRITERIA_CORPUS.map((one, index) => ({ number: index + 1, text: one.text })), "en");
  const found = read.map((one) => CRITERIA_CORPUS[one.number - 1]).map((one) => `${one.issue}#${one.number}`);
  assert.deepEqual(found, ["ISS-474#3", "ISS-500#7", "ISS-500#15"]);
  assert.equal(CRITERIA_CORPUS.length, 60);
});

/* The round the refusal exists to save: a file no consult has read is refused for the grammar, not
   sent to a consult that would judge a line about to be split anyway (ISS-483). */
test("a compound line is refused before the consult the write asks for", () => {
  const file = join(tempRoom("criteria-"), "criteria.md");
  writeFileSync(file, "1. An empty list shows the empty state and hides the export.\n");
  const run = ask("record", "criteria", "ISS-1", file);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /one outcome: An empty list shows the empty state/u);
  assert.doesNotMatch(run.stderr, /No consult has read/u);
});
