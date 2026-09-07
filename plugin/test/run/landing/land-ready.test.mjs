/* The landing itself: what it pins, what it proves before it promotes, and the two outcomes that
   are not a release — a conflict parked and a moved path handed back. Every refusal is read for what
   it names, because a landing that stops for the wrong reason looks exactly like one that stopped
   for the right one, and the one thing none of these may do is release a change twice (ISS-673). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BASE, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, NEXT_UUID, OWNED, RECORD,
  claudeCalls, comments, context, ctx, forgetInstall, git, issue, marks, ready, seeded, serverPushes,
  sha, strayWrites, tracker, world,
} from "./fixture.mjs";

const { landReady } = await import("../../../../tools/run/land-ready.mjs");
const { Stop } = await import("../../../../tools/checkout.mjs");
const { landingOf } = await import("../../../src/flow/lease.mjs");

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
    process.exitCode = 0;
  }
  return out.join("\n");
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
  assert.match(said, new RegExp(`pinned at ${base.slice(0, 7)}`, "u"), said);
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
  assert.equal(held.state, "marked", `no judge is asked for and neither status is earned:\n${said}`);
  assert.match(said, /no judge's turn sits here: this project lands after-merge/u, said);
  assert.match(said, /the checkpoint stays `marked`/u, said);
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

test("the merged mark names the judged head, the landed head and that the landing moved nothing", async () => {
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  const said = await ran([KEY], work);
  assert.equal(marks().length, 1, `one mark and no more:\n${said}`);
  const note = marks()[0].body;
  assert.match(note, new RegExp(`at ${remote(at)}\\b`, "u"), note);
  assert.match(note, new RegExp(`judged head ${head}\\b`, "u"), note);
  assert.match(note, /landing moved nothing;/u, note);
  assert.match(note, new RegExp(`landing wrote ${OWNED.replace(/\//gu, "/")}`, "u"), note);
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
  assert.match(said, new RegExp(`landing moved ${OWNED}`, "u"), said);
  assert.match(said, /reads `reconciled` at/u, said);
  assert.equal(remote(at), pinned, `nothing was pushed:\n${said}`);
  assert.equal(marks().length, 0, `and nothing marked:\n${said}`);
  assert.equal(claudeCalls().length, before, `and nothing installed:\n${said}`);
  /* The builder's reconciliation, written at that candidate and nowhere else: the landing then
     promotes the same candidate, and the mark's judged head is the candidate it judged. */
  issue().sessionContext.landing = { ...held, state: "reconciled", reconciled: held.candidate };
  const after = await ran([KEY], work);
  assert.equal(landing().state, "marked", after);
  assert.notEqual(remote(at), pinned, `the reconciled candidate lands:\n${after}`);
  assert.match(marks()[0].body, new RegExp(`judged head ${held.candidate}\\b`, "u"), marks()[0].body);
  assert.match(marks()[0].body, new RegExp(`landing moved ${OWNED};`, "u"), marks()[0].body);
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
  assert.match(said, new RegExp(`${OWNED} conflict`, "u"), said);
  assert.equal(issue().status, "on_hold", `parked as blocked:\n${said}`);
  const park = comments().find((one) => one.body.includes("Park"));
  assert.ok(park && park.body.includes(OWNED), `the conflict list is attached:\n${park?.body}`);
  assert.equal(landing().state, "candidate", `the checkpoint is not handed to the builder:\n${said}`);
  assert.equal(git(work, "status", "--porcelain").stdout, clean, "no file was edited");
  const held = readFileSync(join(work, OWNED), "utf8");
  assert.ok(!held.includes("<<<<"), `the conflict was not resolved into the tree:\n${held}`);
  assert.match(held, /line 2, as the base moved it/u, "the tree holds the base's own text, not the branch's");
  /* The branch after it is somebody else's release, so the park is not the end of the run. */
  assert.equal(landing(NEXT_UUID).state, "marked", said);
  assert.equal(marks(NEXT_UUID).length, 1, said);
  assert.notEqual(remote(at), pinned, `the second branch landed:\n${said}`);
  assert.match(fileAt(work, remote(at), NEXT_OWNED), /the second change/u, said);
  assert.deepEqual(strayWrites(), [], `and the park is inside the boundary too:\n${said}`);
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
  assert.match(said, new RegExp(`is at ${theirs.slice(0, 7)}`, "u"), said);
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
