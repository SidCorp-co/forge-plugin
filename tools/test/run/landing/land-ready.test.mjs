/* The landing itself: what it pins, what it proves before it promotes, and the two outcomes that
   are not a release — a conflict parked and a moved path handed back. Every refusal is read for what
   it names, because a landing that stops for the wrong reason looks exactly like one that stopped
   for the right one, and the one thing none of these may do is release a change twice (ISS-673). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BASE, BRANCH, BUILDER, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, NEXT_UUID, OWNED, RECORD,
  claudeCalls, comments, context, ctx, earning, forgetInstall, git, issue, marks, ready, seeded,
  serverPushes, sha, state, strayWrites, tracker, world,
} from "./fixture.mjs";
import { escaped, ranAsync } from "../../../../plugin/test/fixtures.mjs";

const FORGE = new URL("../../../../plugin/bin/forge", import.meta.url).pathname;

const { landReady } = await import("../../../run/land-ready.mjs");
const { Stop } = await import("../../../checkout.mjs");
const { landingOf } = await import("../../../../plugin/src/flow/landing/checkpoint.mjs");
const { publishedFor, publishedPath } = await import("../../../../plugin/src/flow/earned/published.mjs");
const { parse } = await import("../../../../plugin/src/flow/record/page.mjs");

test.after(() => tracker.close());

/** The verb, its output captured: a step's own `Stop` is caught by the driver and printed, so what
 *  a refused landing said is the only place the reason is. */
const ran = async (keys, work) => {
  const out = [];
  const kept = [console.log, console.error];
  console.log = (...said) => out.push(said.join(" "));
  console.error = (...said) => out.push(said.join(" "));
  try {
    await landReady({ flags: new Map(), words: keys }, ctx(work));
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    out.push(error.message);
  } finally {
    [console.log, console.error] = kept;
    exited = process.exitCode ?? 0;
    process.exitCode = 0;
  }
  return out.join("\n");
};

/** What the run above left, read before the line resetting it: a member owed something is a stop and
 *  a turn handed over is not, so the code the landing exits with is what tells one from the other. */
let exited = 0;

/** The builder's own commands, through the shipped verb: a landing hands the branch back to a run
 *  of its own, so what that run types is what this suite has to ask for. Twice, since the gate every
 *  write passes delivers a comment this session has not read and refuses once. */
const asBuilder = async (argv) => {
  let run = null;
  for (const again of [1, 2]) {
    run = await ranAsync(FORGE, argv, { ...process.env, FORGE_SESSION_ID: BUILDER }, process.cwd());
    if (run.status === 0 || again === 2) return run;
  }
  return run;
};

const landing = (documentId) => landingOf(context(documentId));
const remote = (at, ref = `refs/heads/${BASE}`) => sha(join(at, "origin.git"), ref);
const fileAt = (work, rev, path) => git(work, "show", `${rev}:${path}`).stdout;
const versionAt = (work, rev) => JSON.parse(fileAt(work, rev, "package.json")).version;

test("a ready branch is pinned, merged, proved to have moved nothing and promoted against that pin", async () => {
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  const said = await ran([KEY], work);
  const landed = remote(at);
  assert.ok(said.includes(`pinned at ${base.slice(0, 7)}`), said);
  assert.match(said, /landing moved nothing of the change/u, said);
  assert.notEqual(landed, base, `${BASE} did not move:\n${said}`);
  /* The release sits on the candidate, and the candidate on both: the base this landing pinned and
     the head it was judged at. A rebase would have left one parent and a different tree. */
  assert.equal(git(work, "rev-parse", `${landed}^^1`).stdout.trim(), base, said);
  assert.equal(git(work, "rev-parse", `${landed}^^2`).stdout.trim(), head, said);
  assert.match(fileAt(work, landed, OWNED), /line 2, as the change wrote it/u, "the change is in it");
  assert.match(fileAt(work, landed, join("docs", "other.md")), /nobody's change/u, "and so is the base's");
  const held = landing();
  assert.equal(held.pinned, base, said);
  assert.equal(held.intended, landed, said);
  assert.equal(held.reconciled, git(work, "rev-parse", `${landed}^`).stdout.trim(), said);
  /* This project asks for no independent judge, so no QA turn is written at all; and its record
     earns neither status, so the checkpoint rests at `marked` for the landing to be run again
     rather than closing at `done` over a `tested` nothing earned. */
  assert.equal(held.state, "records-owed", `no judge is asked for and neither status is earned, so the turn is the builder's:\n${said}`);
  assert.equal(held.owed, "marked", `and the checkpoint names the state it was handed back from:\n${said}`);
  assert.match(said, /no judge's turn sits here: this project lands after-merge/u, said);
  assert.match(said, /the checkpoint reads `records-owed`/u, said);
  assert.match(said, new RegExp(`answered by ${BUILDER}`, "u"),
    `the run that can answer for the records is named, not the rung alone:\n${said}`);
  assert.match(said, new RegExp(`forge claim ${KEY} --take`, "u"), `with the command that takes it:\n${said}`);
  assert.match(said, new RegExp(`forge claim ${KEY} --recorded`, "u"), `and the one that ends it:\n${said}`);
});

/* The tail of the ladder is two rungs and `advance` refuses a jump, so the landing walks them: a
   move to the deploying rung alone would be refused and the checkpoint would rest one rung short of
   `done` on a record that earned both (ISS-1065). Where the walk stops is the release policy's, and
   this project's one branch deploys nothing on its own, so the last rung is a person's (ISS-1147). */
test("the landing walks the judging rung and the deploying one, and rests at done over both", async () => {
  const { work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base), earned: earning(head) });
  const said = await ran([KEY], work);
  assert.equal(issue().status, "awaiting_release", `both rungs were walked:\n${said}`);
  assert.equal(landing().state, "done", `and nothing of the landing is left:\n${said}`);
  assert.match(said, /the checkpoint reads `done`/u, said);
  const moves = state.calls.filter((one) => one.args?.action === "transition").map((one) => one.args.data.status);
  assert.deepEqual(moves, ["developed", "testing", "awaiting_release"],
    `one move per rung, in the table's order, and no jump:\n${said}`);
  /* `done` here means the landing is finished and not that the issue is, so the stop is said. */
  assert.match(said, new RegExp(`${KEY} rests at \`awaiting_release\``, "u"), said);
  assert.match(said, /the release is an act/u,
    `the reason is the project's own, so a reader knows which setting said so:\n${said}`);
  assert.match(said, new RegExp(`the close is theirs and not this landing's`, "u"), said);
  assert.match(said, new RegExp(`forge advance ${KEY}`, "u"),
    `with the command that takes it once the release is out:\n${said}`);
});

/* And the other way: a record earning the judging rung and not the deploying one stops there rather
   than reporting the rung it did reach as the one that is owed. */
test("a landing whose record earns the judging rung alone stops at it and names what the next is owed", async () => {
  const { work, head, base } = world({ base: "other" });
  const { releaseNotes, ...half } = earning(head);
  seeded({ landing: ready(head, base), earned: { ...half, said: half.said.slice(0, 2) } });
  const said = await ran([KEY], work);
  assert.equal(issue().status, "testing", `the judging rung is where it rests:\n${said}`);
  assert.equal(landing().state, "records-owed", `the checkpoint is not done, and the rung left is the builder's:\n${said}`);
  assert.match(said, /what `awaiting_release` is owed is above/u, said);
  assert.match(said, /no verification/u, "and what that is, is on the report");
  assert.ok(releaseNotes.section, "the half withheld is the note, which is what the rung asks for");
});

test("the install after that promotion holds the version the release commit carries", async () => {
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  forgetInstall();
  const said = await ran([KEY], work);
  const landed = remote(at);
  const record = JSON.parse(readFileSync(RECORD, "utf8"));
  const versions = Object.values(record.plugins).flat().map((one) => one.version);
  assert.deepEqual(versions, [versionAt(work, landed)], `the installed copy is the release's:\n${said}`);
  assert.equal(landing().release, versionAt(work, landed), said);
});

/* The other release route publishes what the ship publishes, so a run cutting from a head this landing released cites the gate rather than running one. Only the call-site half is reachable here — that the publish cannot break a landing — because `greenHeld` reads *this* repository's step table and the world a landing fixture builds is not this repository, so no publication is obtainable however green anything is; the positive path is proven over the same function, against a ledger of its own, in `tools/test/flow/published-baseline.test.mjs`. */
test("the landing offers the head it released to the publisher, and is not stopped by what it answers", async () => {
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  forgetInstall();
  const said = await ran([KEY], work);
  const landed = remote(at);
  assert.ok(said.includes(`nothing is published for ${landed.slice(0, 7)}`),
    `the landing did not offer its released head to the publisher:\n${said}`);
  assert.equal(landing().release, versionAt(work, landed),
    `and the landing finished all the same, a record it cannot read being no release to stop:\n${said}`);
  assert.equal(publishedFor("forge-plugin", landed), null,
    "nothing is published off a step table this fixture's world cannot satisfy");
  /* The store a release-time write would land in is inside the test's own temp root, and the only thing putting it there is `Object.assign(process.env, tracker.env)` in `fixture.mjs` carrying the tracker fixture's `XDG_CONFIG_HOME` — asserted because nothing else in this harness says the developer's live configuration directory is out of reach. */
  assert.ok(publishedPath().startsWith(process.env.TMPDIR),
    `a release-time write would land outside the test root: ${publishedPath()}`);
});

/* The one other caller of `versionAbove`, reaching it with no note at all: what a refusal of a
   caller's own subject may not cost is the batch's, which has none to be wrong (ISS-965). */
test("the batch's release commit carries the composed subject, having no note to check", async () => {
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  const said = await ran([KEY], work);
  const landed = remote(at);

  assert.equal(git(work, "log", "--format=%s", "-1", landed).stdout.trim(),
    `chore(release): ${versionAt(work, landed)}, so the installed copy is this head`, said);
});

test("the merged mark names the judged head, the landed head and that the landing moved nothing", async () => {
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  const said = await ran([KEY], work);
  assert.equal(marks().length, 1, `one mark and no more:\n${said}`);
  const note = marks()[0].body;
  assert.match(note, new RegExp(`at ${escaped(remote(at))}\\b`, "u"), note);
  assert.match(note, new RegExp(`judged head ${escaped(head)}\\b`, "u"), note);
  assert.match(note, /landing moved nothing;/u, note);
  assert.ok(note.includes(`landing wrote ${OWNED}`), note);
});

test("the landing writes the checkpoint, the mark and the statuses, and no judgement of its own", async () => {
  const { work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  const said = await ran([KEY], work);
  assert.deepEqual(strayWrites(), [], `nothing outside the landing's own writes:\n${said}`);
  /* Every comment on the issue is the mark's own audit line: no verdict, no review, no plan. */
  for (const one of comments()) assert.match(one.body, /^mark_merged\b/u, one.body);
});

test("a base that moved a line of the change's own file hands the branch back, releasing nothing", async () => {
  const { at, work, head, base } = world({ base: "moved" });
  const pinned = sha(work, BASE);
  seeded({ landing: ready(head, base) });
  forgetInstall();
  const before = claudeCalls().length;
  const said = await ran([KEY], work);
  const held = landing();
  assert.equal(held.state, "builder-owed", said);
  assert.equal(held.moved, OWNED, `the path it moved is named:\n${said}`);
  assert.ok(said.includes(`landing moved ${OWNED}`), said);
  assert.match(said, /reads `reconciled` at/u, said);
  /* What the stop asks for is the reading, and the branch is left alone: a stop asking for a rebase
     is one that sends the run to force-push the head this landing fetches into an orphan (ISS-1638). */
  assert.match(said, /the branch stays where it is/u, said);
  assert.ok(said.includes(`read ${OWNED} as ${held.candidate.slice(0, 7)} has them`), said);
  assert.equal(/rebas/iu.test(said.split("is parked as blocked")[0]), false,
    `nothing the hand-back prints asks for a rebase:\n${said}`);
  assert.equal(remote(at), pinned, `nothing was pushed:\n${said}`);
  assert.equal(marks().length, 0, `and nothing marked:\n${said}`);
  assert.equal(claudeCalls().length, before, `and nothing installed:\n${said}`);
  /* The two commands the stop above names, run as the builder would run them rather than written
     into the field: a fixture standing in for them is how this suite passed for years without asking
     whether the builder had a route out at all (ISS-726). Their own refusals are the claim's tests. */
  const took = await asBuilder(["claim", KEY, "--take"]);
  assert.equal(took.status, 0, `${took.stdout}${took.stderr}`);
  const wrote = await asBuilder(["claim", KEY, "--reconciled", held.candidate]);
  assert.equal(wrote.status, 0, `${wrote.stdout}${wrote.stderr}`);
  assert.equal(landing().state, "reconciled", `the builder's own write moved it:\n${wrote.stdout}`);
  assert.equal(landing().reconciled, held.candidate, wrote.stdout);
  const after = await ran([KEY], work);
  assert.equal(landing().state, "records-owed", after);
  assert.notEqual(remote(at), pinned, `the reconciled candidate lands:\n${after}`);
  assert.match(marks()[0].body, new RegExp(`judged head ${escaped(held.candidate)}\\b`, "u"), marks()[0].body);
  /* git's reading of the judged head against the candidate it names, which moved nothing: the paths the
     reconcile read beside that head stood down the verdicts the builder took there (ISS-1362). */
  assert.ok(marks()[0].body.includes("landing moved nothing;"), marks()[0].body);
});

/* Four runs of one wave were each refused at the last record and every refusal was right: the rungs left after the mark are earned by records only the builder can answer, and the checkpoint gave that state to the lander. Watched end to end, through the shipped commands (ISS-923). */
test("the builder writes the records the landing stops for, and the landing finishes on its own turn", async () => {
  const { work, head, base } = world({ base: "other" });
  /* The criteria, and a plan naming a file this change never wrote, so the landing's mark owes a
     correction as well as a review: both are reasons only the run that built it knows. */
  seeded({
    landing: ready(head, base),
    earned: {
      acceptanceCriteria: "1. it lands",
      plan: "Screen change: no\nSchema coupling: no\nUser-facing outcome: no\n\nIt edits docs/other.md.\n\n1. it lands\n",
    },
  });
  const first = await ran([KEY], work);
  const held = landing();
  assert.equal(held.state, "records-owed", `the record earns no rung, so the turn is the builder's:\n${first}`);
  assert.equal(held.owed, "marked", first);
  assert.equal(exited, 0, `a turn handed over is what this step is for and not a failure of it:\n${first}`);
  const landed = marks()[0].body.match(/at ([0-9a-f]{40})/u)[1];

  const took = await asBuilder(["claim", KEY, "--take"]);
  assert.equal(took.status, 0, `${took.stdout}${took.stderr}`, "no lease was waited out");
  assert.doesNotMatch(`${took.stdout}${took.stderr}`, /Reclaim \d+ of/u,
    `and no reclaim was spent on it:\n${took.stdout}`);

  /* Written by the run that can answer for them, which is the one thing the lander could not do. */
  const review = await asBuilder(["record", "review", KEY, "--reviewer", "codex",
    "--commit", landed, "--outcome", "approved", "--finding", "F1 accepted"]);
  assert.equal(review.status, 0, `${review.stdout}${review.stderr}`);
  const verdict = await asBuilder(["record", "verdict", KEY, "--criterion", "1",
    "--verdict", "pass", "--commit", landed, "--evidence", landed]);
  assert.equal(verdict.status, 0, `${verdict.stdout}${verdict.stderr}`);

  const correction = await asBuilder(["record", "correction", KEY,
    "--moved", OWNED, "--why", "the plan named another file and this is the one that landed"]);
  assert.equal(correction.status, 0, `${correction.stdout}${correction.stderr}`,
    "the reason only this run knows is typed by this run");
  const verified = await asBuilder(["record", "verification", KEY,
    "--where", "the installed plugin", "--commit", landed, "--evidence", "https://ci.example.test/12"]);
  assert.equal(verified.status, 0, `${verified.stdout}${verified.stderr}`);
  const note = await asBuilder(["record", "note", KEY, "--section", "Fixed", "--user", "it works"]);
  assert.equal(note.status, 0, `${note.stdout}${note.stderr}`);

  const back = await asBuilder(["claim", KEY, "--recorded"]);
  assert.equal(back.status, 0, `${back.stdout}${back.stderr}`);
  assert.equal(landing().state, "marked", `the turn goes back to the state it came from:\n${back.stdout}`);

  /* Twice: the builder's records are comments this lander has not been shown, and the gate every
     write passes delivers them before it spends one. */
  const shown = await ran([KEY], work);
  assert.match(shown, /has not been shown/u, `the records reach the landing before they are spent:\n${shown}`);
  const after = await ran([KEY], work);
  assert.equal(issue().status, "awaiting_release", `the landing walks every rung it stopped short of:\n${after}`);
  assert.equal(landing().state, "done", `and nothing of the landing is left:\n${after}`);
  assert.equal(marks().length, 1, `over the release it already made:\n${after}`);
  assert.doesNotMatch(after, /records-owed/u, `with no second hand-back:\n${after}`);
});

/* The other half of re-judging nothing: an empty hand-back is answered by the walk, not the verb. */
test("a records turn handed back with nothing written comes back, and no rung moves", async () => {
  const { work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  const first = await ran([KEY], work);
  assert.equal(landing().state, "records-owed", first);
  const was = issue().status;
  const took = await asBuilder(["claim", KEY, "--take"]);
  assert.equal(took.status, 0, `${took.stdout}${took.stderr}`);
  const back = await asBuilder(["claim", KEY, "--recorded"]);
  assert.equal(back.status, 0, `${back.stdout}${back.stderr}`, "the hand-back reads no record and refuses none");
  const after = await ran([KEY], work);
  assert.equal(landing().state, "records-owed", `the turn comes back:\n${after}`);
  assert.equal(issue().status, was, `and no rung was earned on the way:\n${after}`);
});

/* Read before the lease is taken, a take being a write this state gives no lander business making. */
test("a landing over a checkpoint whose records turn is out refuses, naming the state", async () => {
  const { work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  await ran([KEY], work);
  assert.equal(landing().state, "records-owed");
  const said = await ran([KEY], work);
  assert.match(said, /reads `records-owed`, which is not a step this task owes/u, said);
  assert.match(said, /when the state names the lander's turn/u, said);
});

test("a reconciliation naming another candidate promotes nothing", async () => {
  const { at, work, head, base } = world({ base: "moved" });
  const pinned = sha(work, BASE);
  seeded({ landing: ready(head, base, { state: "reconciled", pinned, reconciled: head, candidate: head }) });
  const said = await ran([KEY], work);
  assert.match(said, /not the candidate this landing built/u, said);
  assert.equal(remote(at), pinned, `nothing was pushed:\n${said}`);
});

test("a branch that conflicts with the pinned base is parked with the list, and the next branch lands", async () => {
  const { at, work, head, next, base } = world({ base: "conflict", second: true });
  const pinned = sha(work, BASE);
  seeded({
    landing: ready(head, base),
    next: ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }),
  });
  const clean = git(work, "status", "--porcelain").stdout;
  const said = await ran([KEY, NEXT_KEY], work);
  assert.ok(said.includes(`${OWNED} conflict`), said);
  assert.equal(issue().status, "on_hold", `parked as blocked:\n${said}`);
  const park = comments().find((one) => one.body.includes("Park"));
  assert.ok(park && park.body.includes(OWNED), `the conflict list is attached:\n${park?.body}`);
  /* Handed to the builder with the park, since the answer is a head that merges and only that run
     makes one; the reason names the capture that state accepts (ISS-2299, after ISS-1652). */
  assert.equal(landing().state, "head-owed", `the checkpoint is the builder's again:\n${said}`);
  assert.ok(park.body.includes(`forge claim ${KEY} --take`), `the park names the take:\n${park.body}`);
  assert.ok(park.body.includes(`forge claim ${KEY} --pushed --ready`), `and the capture:\n${park.body}`);
  assert.doesNotMatch(park.body, /rebases it/u, `and no rebase that orphans the judged head:\n${park.body}`);
  /* The paths in the reason and the two commits as the evidence, which is what the park reader keeps
     and pairs with the move, so the builder lifts it with a step rather than a set (ISS-2449). */
  const record = parse(park.body);
  assert.deepEqual(record.fields.evidence, [head, pinned], `the two commits the merge was taken between:\n${park.body}`);
  assert.ok(record.fields.why.includes(`${OWNED} conflict`), `the paths stay in the reason:\n${park.body}`);
  const took = await asBuilder(["claim", KEY, "--take"]);
  assert.equal(took.status, 0, `${took.stdout}${took.stderr}`);
  const lifted = await asBuilder(["advance", KEY, "--to", "in_progress"]);
  assert.equal(lifted.status, 0, `${lifted.stdout}${lifted.stderr}`);
  assert.doesNotMatch(`${lifted.stdout}${lifted.stderr}`, /--set/u, "no status write is offered");
  assert.equal(issue().status, "in_progress", `the park is lifted by a step:\n${lifted.stdout}${lifted.stderr}`);
  assert.equal(sha(join(at, "origin.git"), `refs/heads/${BRANCH}`), head, `no ref of the branch was written:\n${said}`);
  assert.equal(git(work, "status", "--porcelain").stdout, clean, "no file was edited");
  const held = readFileSync(join(work, OWNED), "utf8");
  assert.ok(!held.includes("<<<<"), `the conflict was not resolved into the tree:\n${held}`);
  assert.match(held, /line 2, as the base moved it/u, "the tree holds the base's own text, not the branch's");
  /* The branch after it is somebody else's release, so the park is not the end of the run. */
  assert.equal(landing(NEXT_UUID).state, "records-owed", said);
  assert.equal(marks(NEXT_UUID).length, 1, said);
  assert.notEqual(remote(at), pinned, `the second branch landed:\n${said}`);
  assert.match(fileAt(work, remote(at), NEXT_OWNED), /the second change/u, said);
  assert.deepEqual(strayWrites(), [], `and the park is inside the boundary too:\n${said}`);
});

/* ISS-730: the note is fitted to the tracker's cap, and the one shape it will not fit is a change
   whose paths the plan names none of. That refusal arrives after the push and the install, so what
   this watches is the route it takes: this step's own stop, and the checkpoint still `installed` for
   the run that comes back. */
const UNNAMED = Array.from({ length: 119 },
  (_, one) => `plugin/src/flow/record/case-${String(one).padStart(3, "0")}.mjs`);

test("a note the composer cannot fit stops the mark as this step's own stop and keeps the checkpoint", async () => {
  const { at, work, head, base } = world({ base: "other" });
  const pinned = sha(work, BASE);
  seeded({ landing: ready(head, base, { files: UNNAMED }) });
  const said = await ran([KEY], work);
  assert.match(said, /the plan and its corrections do not name/u, said);
  assert.match(said, new RegExp(`forge record correction ${KEY} --moved`, "u"),
    `the write that clears it:\n${said}`);
  assert.match(said, /stopped at step \d+ \(the merged mark\)/u,
    `the step's own stop and not a thrown error:\n${said}`);
  assert.equal(landing().state, "installed", `the checkpoint waits at the mark:\n${said}`);
  assert.equal(marks().length, 0, `and nothing was marked:\n${said}`);
  assert.notEqual(remote(at), pinned, `the release landed all the same:\n${said}`);
  assert.deepEqual(strayWrites(), [], `and the stop is inside the landing's own writes:\n${said}`);
});

/* And beside another branch on the same candidate the refusal is that member's alone: after the push
   every member holds the release that went out, so what a stop leaves is what that one is owed and
   no reason to keep the mark and the statuses from the branch beside it (ISS-722). */
test("a note that will not fit is one member's own, and the branch beside it is marked all the same", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true });
  const pinned = sha(work, BASE);
  seeded({
    landing: ready(head, base, { files: UNNAMED }),
    next: ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }),
  });
  const said = await ran([KEY, NEXT_KEY], work);
  assert.match(said, new RegExp(`${KEY}: the note is \\d+ code points over`, "u"),
    `the refusal is that member's, named:\n${said}`);
  assert.match(said, /the plan and its corrections do not name/u, said);
  assert.equal(landing().state, "installed", `whose checkpoint waits at the mark:\n${said}`);
  assert.equal(marks().length, 0, `and nothing of it was marked:\n${said}`);
  assert.equal(landing(NEXT_UUID).state, "records-owed", `the branch beside it is marked and its records are owed:\n${said}`);
  assert.equal(marks(NEXT_UUID).length, 1, said);
  assert.notEqual(remote(at), pinned, `and the release the two share landed:\n${said}`);
  assert.deepEqual(strayWrites(), [], `and the stop is inside the landing's own writes:\n${said}`);
});

test("a base head past the pin refuses the promotion, names it, and rebuilds from the new head", async () => {
  const { at, work, head, base } = world({ base: "other" });
  const pinned = sha(work, BASE);
  /* The state a landing dies in between its version commit and its push: the checkpoint holds the
     pin and an intended release nothing on the server carries. */
  seeded({
    landing: ready(head, base, {
      state: "promoting", pinned, candidate: head, reconciled: head, intended: head, release: "1.0.1",
    }),
  });
  const theirs = serverPushes(at, "1.0.5");
  assert.equal(sha(work, `refs/remotes/origin/${BASE}`), pinned,
    "the tracking ref still names the pin, so only the remote itself can say the base moved");
  const said = await ran([KEY], work);
  assert.ok(said.includes(`is at ${theirs.slice(0, 7)}`), said);
  assert.match(said, /rebuilt from the new head/u, said);
  const held = landing();
  assert.equal(held.pinned, theirs, `the fresh pin is the checkpoint's:\n${said}`);
  assert.notEqual(held.candidate, head, `the candidate built at the old pin is void:\n${said}`);
  assert.equal(held.reconciled, held.candidate, `and its reconciliation is the new one's:\n${said}`);
  assert.equal(git(work, "merge-base", "--is-ancestor", theirs, remote(at)).status, 0,
    `the other clone's release is still on the branch:\n${said}`);
  assert.equal(versionAt(work, remote(at)), "1.0.6", `the version follows the fresh pin:\n${said}`);
  assert.equal(marks().length, 1, `one release, one mark:\n${said}`);
});
