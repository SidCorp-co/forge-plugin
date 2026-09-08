/* The branches a landing is given taken as one candidate: what one gate, one version and one push
   leave on each issue, and the four outcomes a set has that a single branch has not — a member the
   base moved handed back while the others land, a member a sibling moved landed after them, a
   combination the gate refuses landed one at a time, and a reading whose set is no longer this one
   voided. Every refusal is read for what it names, because a set that stopped for the wrong reason
   looks exactly like one that stopped for the right one (ISS-722). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BASE, BUILDER, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, NEXT_UUID, OWNED, PAIRED_GATE, RECORD,
  THIRD_BRANCH, THIRD_KEY, THIRD_OWNED, THIRD_UUID, UUID,
  comments, context, ctx, forgetGateRuns, forgetInstall, gateRuns, git, issue, marks,
  ready, redTogether, seeded, sha, state, strayWrites, tracker, world,
} from "./fixture.mjs";
import { ranAsync } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const { landReady } = await import("../../../../tools/run/land-ready.mjs");
const { Stop } = await import("../../../../tools/checkout.mjs");
const { landingOf } = await import("../../../src/flow/lease.mjs");

test.after(() => tracker.close());

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
const holds = (work, rev, head) => git(work, "merge-base", "--is-ancestor", head, rev).status === 0;
/** The second and third branches as a build leaves them, each with its own file and branch. */
const beside = (next, base) => ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] });
const behind = (last, base, files = [THIRD_OWNED]) =>
  ready(last, base, { branch: THIRD_BRANCH, files });

test("two ready branches make one candidate, one gate, one version and one update to the base", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true, gate: PAIRED_GATE });
  const pinned = sha(work, BASE);
  seeded({ landing: ready(head, base), next: beside(next, base) });
  forgetGateRuns();
  forgetInstall();
  const said = await ran([KEY, NEXT_KEY], work);
  const landed = remote(at);
  assert.match(said, /=== ISS-673 ISS-674, as one candidate/u, said);
  assert.deepEqual(gateRuns(), ["green"], `one gate run for the two of them:\n${said}`);
  assert.ok(holds(work, landed, head) && holds(work, landed, next),
    `both heads are in what landed:\n${said}`);
  assert.match(fileAt(work, landed, OWNED), /line 2, as the change wrote it/u, said);
  assert.match(fileAt(work, landed, NEXT_OWNED), /the second change/u, said);
  /* One update, so the base grew by the two merges and one version over them, and one release
     commit stands between the pin and what landed rather than a release for each branch. */
  const grew = git(work, "rev-list", "--count", "--first-parent", `${pinned}..${landed}`).stdout.trim();
  assert.equal(grew, "3", `two merges and one version commit:\n${said}`);
  const bumps = git(work, "rev-list", "--count", `${pinned}..${landed}`, "--", "package.json").stdout.trim();
  assert.equal(bumps, "1", `one version raised for the set:\n${said}`);
  assert.equal(versionAt(work, landed), "1.0.1", said);
  assert.notEqual(landed, pinned, said);
  const record = JSON.parse(readFileSync(RECORD, "utf8"));
  assert.deepEqual([...new Set(Object.values(record.plugins).flat().map((one) => one.version))], ["1.0.1"],
    `and one installed copy, at that version:\n${said}`);
});

test("each member of that set takes its own mark and names no other member on its checkpoint", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true });
  seeded({ landing: ready(head, base), next: beside(next, base) });
  const said = await ran([KEY, NEXT_KEY], work);
  const landed = remote(at);
  for (const [uuid, key, at2] of [[undefined, KEY, head], [NEXT_UUID, NEXT_KEY, next]]) {
    const note = marks(uuid)[0]?.body ?? "";
    assert.equal(marks(uuid).length, 1, `one mark on ${key}:\n${said}`);
    assert.match(note, new RegExp(`at ${landed}\\b`, "u"), note);
    assert.match(note, new RegExp(`judged head ${at2}\\b`, "u"), note);
  }
  assert.ok(!JSON.stringify(context()).includes(NEXT_KEY), `ISS-673 names no batchmate:\n${said}`);
  assert.ok(!JSON.stringify(context(NEXT_UUID)).includes(KEY), `nor ISS-674:\n${said}`);
  assert.deepEqual(strayWrites(), [], `and the set is inside the landing's own writes:\n${said}`);
});

/* AC-05-10-7: green apart and red together is a fact about the pair, so no subset is searched for
   and neither branch is named as the cause. The one landed is the one the gate passed first. */
test("a combination the gate refuses lands one branch and refuses the other against the new base", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true, gate: PAIRED_GATE });
  seeded({ landing: ready(head, base), next: beside(next, base) });
  forgetGateRuns();
  redTogether();
  const said = await ran([KEY, NEXT_KEY], work);
  assert.match(said, /are green apart and red together/u, said);
  assert.match(said, /No subset is searched for/u, said);
  assert.doesNotMatch(said, new RegExp(`${NEXT_BRANCH} (is the|broke|failed)`, "u"),
    `neither branch is blamed for the combination:\n${said}`);
  assert.deepEqual(gateRuns(), ["red", "green", "red"],
    `one run for the candidate and one for each branch, and no search:\n${said}`);
  const landed = remote(at);
  assert.ok(holds(work, landed, head), `the first branch landed:\n${said}`);
  assert.ok(!holds(work, landed, next), `and the second did not:\n${said}`);
  assert.equal(landing().state, "marked", said);
  assert.equal(marks(NEXT_UUID).length, 0, `nothing of it is marked:\n${said}`);
  /* Refused where its own gate ran: the pin under it is the base the first branch landed on, and
     what it is reconciled at is that candidate rather than the combination it was read at. */
  assert.equal(landing(NEXT_UUID).pinned, landed, `it was gated against the new base:\n${said}`);
  const chain = /candidate ([0-9a-f]{7}) over 2 file/u.exec(said)?.[1];
  assert.ok(chain, said);
  assert.ok(!landing(NEXT_UUID).reconciled.startsWith(chain),
    `its reading at the combination is void:\n${said}`);
  assert.equal(landing(NEXT_UUID).reconciled, landing(NEXT_UUID).candidate, said);
  assert.match(said, /stopped at step 4 \(the gate over the candidate\)/u,
    `with the failing step named:\n${said}`);
});

test("the bound on the gate runs a set may spend is named before the first of them is spent", async () => {
  const { work, head, next, base } = world({ base: "other", second: true });
  seeded({ landing: ready(head, base), next: beside(next, base) });
  const said = await ran([KEY, NEXT_KEY], work);
  const bound = said.indexOf("3 gate run(s) at most");
  assert.ok(bound > 0, `the bound is printed:\n${said}`);
  assert.ok(bound < said.indexOf("step 4/10"), `before the gate runs:\n${said}`);
  assert.match(said, /one for the candidate, and one for each branch/u, said);
  assert.match(said, /and one more of any of them where master moves under a pin/u, said);
});

/* The candidate a hand-back names is the merge of that branch alone, which a later landing of that
   branch alone builds again — a chain of several never would, and the reconciliation would name a
   commit nothing rebuilds (ISS-726). */
test("a branch whose paths the base moved is handed back alone, and the rest of the set lands", async () => {
  const { at, work, head, next, base } = world({ base: "moved", second: true });
  const pinned = sha(work, BASE);
  seeded({ landing: ready(head, base), next: beside(next, base) });
  const said = await ran([KEY, NEXT_KEY], work);
  const held = landing();
  assert.equal(held.state, "builder-owed", said);
  assert.equal(held.moved, OWNED, said);
  assert.ok(!holds(work, remote(at), head), `nothing of it was pushed:\n${said}`);
  assert.equal(marks().length, 0, `nor marked:\n${said}`);
  assert.notEqual(remote(at), pinned, `and the branch beside it landed:\n${said}`);
  assert.equal(landing(NEXT_UUID).state, "marked", said);
  /* The sha it was handed is one the builder's own claim takes, which is the whole of the route out. */
  const took = await asBuilder(["claim", KEY, "--take"]);
  assert.equal(took.status, 0, `${took.stdout}${took.stderr}`);
  const wrote = await asBuilder(["claim", KEY, "--reconciled", held.candidate]);
  assert.equal(wrote.status, 0, `${wrote.stdout}${wrote.stderr}`);
  assert.equal(landing().reconciled, held.candidate, wrote.stdout);
});

/* Two branches writing one file is what no path list tells apart and what the chain has to run into:
   the second leaves the set with nothing owed to anybody, and meets that file as the next pin's. */
test("a branch a sibling moved leaves the set with no hand-back, and is landed against the new base", async () => {
  const { at, work, head, last, base } = world({ base: "other", shared: true });
  seeded({ landing: ready(head, base), last: behind(last, base, [OWNED]) });
  const said = await ran([KEY, THIRD_KEY], work);
  assert.match(said, new RegExp(`${THIRD_BRANCH} and a branch beside it write the same paths`, "u"), said);
  assert.match(said, new RegExp(`${THIRD_KEY} is out of this landing`, "u"), said);
  const landed = remote(at);
  assert.ok(holds(work, landed, head), `the set landed:\n${said}`);
  assert.equal(landing().state, "marked", said);
  /* Landed after them, and the pin it met is the base they left: there the move is the base's own,
     so its builder is the one asked about it — no park and no hand-back while the set was landing. */
  assert.equal(landing(THIRD_UUID).pinned, landed, said);
  assert.equal(landing(THIRD_UUID).state, "builder-owed", said);
  assert.equal(landing(THIRD_UUID).moved, OWNED, said);
  assert.equal(comments(THIRD_UUID).filter((one) => one.body.includes("## Park")).length, 0,
    `nothing of it was parked:\n${said}`);
});

test("a branch that conflicts with the pin is parked and the two beside it land as one release", async () => {
  const { at, work, head, next, last, base } = world({ base: "conflict", second: true, third: true });
  seeded({ landing: ready(head, base), next: beside(next, base), last: behind(last, base) });
  const said = await ran([KEY, NEXT_KEY, THIRD_KEY], work);
  assert.match(said, new RegExp(`${OWNED} conflict`, "u"), said);
  assert.equal(issue().status, "on_hold", `parked as blocked:\n${said}`);
  const landed = remote(at);
  assert.ok(holds(work, landed, next) && holds(work, landed, last),
    `the two beside it are one release:\n${said}`);
  assert.equal(landing(NEXT_UUID).release, landing(THIRD_UUID).release, said);
  assert.equal(marks(NEXT_UUID).length, 1, said);
  assert.equal(marks(THIRD_UUID).length, 1, said);
  assert.deepEqual(strayWrites(), [], said);
});

/* The chain is a function of the pin and the ordered heads, so a set run again builds the same
   candidate and every member's reconciliation still answers for it. */
test("a set run again after a death before its push rebuilds the same candidate and voids nothing", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true });
  seeded({ landing: ready(head, base), next: beside(next, base) });
  const first = await ran([KEY, NEXT_KEY], work);
  const built = landing().candidate;
  assert.equal(landing(NEXT_UUID).candidate, built, `one candidate for the two of them:\n${first}`);
  /* Wound back to the state a death between the reconciliation and the push leaves: the base where
     it was pinned, and both checkpoints reconciled at the candidate this set builds. */
  git(join(at, "origin.git"), "update-ref", `refs/heads/${BASE}`, landing().pinned);
  const again = (uuid) => {
    issue(uuid).sessionContext.landing = {
      ...landing(uuid), state: "reconciled", intended: "", release: "",
    };
  };
  again();
  again(NEXT_UUID);
  comments().length = 0;
  comments(NEXT_UUID).length = 0;
  const said = await ran([KEY, NEXT_KEY], work);
  assert.match(said, new RegExp(`candidate ${built.slice(0, 7)}`, "u"),
    `the same candidate, rebuilt:\n${said}`);
  assert.doesNotMatch(said, /is not this one, so it is void/u, `and nothing voided:\n${said}`);
  assert.equal(landing().reconciled, built, said);
  assert.ok(holds(work, remote(at), head), `and the set landed:\n${said}`);
});

/* A reading taken in another set is a reading of a candidate no landing here builds, and the landing
   is the one that took it: voided as a moved pin voids one, and made again. */
test("a reconciliation taken in another set is voided and made again at this set's candidate", async () => {
  const { at, work, head, next, last, base } = world({ base: "other", second: true, third: true });
  seeded({ landing: ready(head, base), next: beside(next, base), last: behind(last, base) });
  const first = await ran([KEY, NEXT_KEY], work);
  const gone = landing().candidate;
  git(join(at, "origin.git"), "update-ref", `refs/heads/${BASE}`, landing().pinned);
  for (const uuid of [undefined, NEXT_UUID]) {
    issue(uuid).sessionContext.landing = {
      ...landing(uuid), state: "reconciled", intended: "", release: "",
    };
    comments(uuid).length = 0;
  }
  assert.equal(landing().reconciled, gone, first);
  const said = await ran([KEY, NEXT_KEY, THIRD_KEY], work);
  assert.match(said, new RegExp(`${KEY} was reconciled at ${gone.slice(0, 7)}`, "u"), said);
  assert.match(said, /is not this one, so it is void/u, said);
  const held = landing();
  assert.notEqual(held.reconciled, gone, `made again at the candidate this set builds:\n${said}`);
  assert.equal(held.reconciled, held.candidate, said);
  assert.equal(landing(THIRD_UUID).candidate, held.candidate, `which is the three of them:\n${said}`);
  assert.ok(holds(work, remote(at), last), said);
});

/* The one window a set has: the release is saved on one member and the process dies before the next.
   Nothing names the set on either checkpoint, so what recovers it is the order the queue lands in —
   the member holding the release first, whatever order the keys arrived in. */
test("a set interrupted between its promoting saves pushes the release it intended and no second one", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true, gate: PAIRED_GATE });
  seeded({ landing: ready(head, base), next: beside(next, base) });
  forgetGateRuns();
  const first = await ran([KEY, NEXT_KEY], work);
  const held = landing();
  const meant = held.intended;
  assert.ok(meant, first);
  git(join(at, "origin.git"), "update-ref", `refs/heads/${BASE}`, held.pinned);
  issue().sessionContext.landing = { ...held, state: "promoting" };
  issue(NEXT_UUID).sessionContext.landing = {
    ...landing(NEXT_UUID), state: "reconciled", intended: "", release: "",
  };
  comments().length = 0;
  comments(NEXT_UUID).length = 0;
  forgetGateRuns();
  const said = await ran([NEXT_KEY, KEY], work);
  assert.ok(said.indexOf(`=== ${KEY}`) < said.indexOf(`=== ${NEXT_KEY}`),
    `the release already meant is landed first, whatever the order asked for:\n${said}`);
  assert.ok(holds(work, remote(at), meant), `the commit it meant to push is on the branch:\n${said}`);
  assert.equal(landing().intended, meant, `not rebuilt into a second release:\n${said}`);
  assert.equal(marks().length, 1, said);
  assert.match(marks()[0].body, new RegExp(`at ${meant}\\b`, "u"), marks()[0].body);
  /* And the member left behind is read off that same release: the branch carries its change, so it
     is marked at the commit that carries it and no candidate, gate or version is spent on it. */
  assert.equal(marks(NEXT_UUID).length, 1, said);
  assert.match(marks(NEXT_UUID)[0].body, new RegExp(`at ${meant}\\b`, "u"), marks(NEXT_UUID)[0].body);
  assert.ok(holds(work, meant, next), `${meant} holds the change it marks:\n${said}`);
  assert.equal(landing(NEXT_UUID).intended, meant, said);
  assert.deepEqual(gateRuns(), [], `nothing is gated again to recover it:\n${said}`);
  const bumps = git(work, "rev-list", "--count", `${held.pinned}..${remote(at)}`, "--", "package.json");
  assert.equal(bumps.stdout.trim(), "1", `one release for the two of them, as it meant:\n${said}`);
  assert.equal(remote(at), meant, `and the branch is at it:\n${said}`);
  assert.equal(versionAt(work, meant), "1.0.1", said);
});

/* Read off the remote and off the holder's own state, neither of them the ancestry: a release built
   and not pushed is readable in this checkout for as long as its objects last, and an install
   nobody ran is not a step to write on a second issue's record. */
test("a release the base does not carry recovers nobody, and that member takes its own candidate", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true, gate: PAIRED_GATE });
  seeded({ landing: ready(head, base), next: beside(next, base) });
  const pinned = sha(work, BASE);
  forgetGateRuns();
  const first = await ran([KEY, NEXT_KEY], work);
  const meant = landing().intended;
  assert.ok(meant, first);
  /* The push undone, so that release is a commit this checkout holds and the branch does not. */
  git(join(at, "origin.git"), "update-ref", `refs/heads/${BASE}`, pinned);
  issue().sessionContext.landing = { ...landing(), state: "installed" };
  issue(NEXT_UUID).sessionContext.landing = {
    ...landing(NEXT_UUID), state: "reconciled", intended: "", release: "",
  };
  comments().length = 0;
  comments(NEXT_UUID).length = 0;
  forgetGateRuns();
  const said = await ran([KEY, NEXT_KEY], work);
  const landed = remote(at);
  assert.notEqual(landed, meant, `the branch never took that release:\n${said}`);
  assert.ok(holds(work, landed, next), `so this change lands on its own account:\n${said}`);
  assert.deepEqual(gateRuns(), ["green"], `and pays its own gate for it:\n${said}`);
  assert.equal(marks(NEXT_UUID).length, 1, said);
  assert.match(marks(NEXT_UUID)[0].body, new RegExp(`at ${landed}\\b`, "u"), marks(NEXT_UUID)[0].body);
  assert.notEqual(landing(NEXT_UUID).intended, meant, `nothing of it reads that release:\n${said}`);
});

/* The other half of that reading: the release's own landing is over, so its key is not this task's
   to take — and its checkpoint is still where the release that carried the other one is named. */
test("a release its own landing finished carries the member left behind, off a checkpoint it may not take", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true, gate: PAIRED_GATE });
  seeded({ landing: ready(head, base), next: beside(next, base) });
  forgetGateRuns();
  const first = await ran([KEY, NEXT_KEY], work);
  const meant = landing().intended;
  assert.ok(meant, first);
  issue().sessionContext.landing = { ...landing(), state: "done" };
  issue(NEXT_UUID).sessionContext.landing = {
    ...landing(NEXT_UUID), state: "reconciled", intended: "", release: "",
  };
  comments(NEXT_UUID).length = 0;
  const kept = JSON.stringify(context());
  const marked = marks().length;
  forgetGateRuns();
  const said = await ran([KEY, NEXT_KEY], work);
  assert.match(said, /is not this landing's to take/u, said);
  assert.equal(remote(at), meant, `the branch stays at the release it took:\n${said}`);
  assert.deepEqual(gateRuns(), [], `and no gate is spent recovering the other:\n${said}`);
  assert.equal(marks(NEXT_UUID).length, 1, said);
  assert.match(marks(NEXT_UUID)[0].body, new RegExp(`at ${meant}\\b`, "u"), marks(NEXT_UUID)[0].body);
  assert.equal(JSON.stringify(context()), kept, `nothing is written on the record it read:\n${said}`);
  assert.equal(marks().length, marked, said);
});

test("a release nobody installed recovers nobody, and nothing of that member is written", async () => {
  const { work, head, next, base } = world({ base: "other", second: true, gate: PAIRED_GATE });
  seeded({ landing: ready(head, base), next: beside(next, base) });
  forgetGateRuns();
  const first = await ran([KEY, NEXT_KEY], work);
  const meant = landing().intended;
  assert.ok(meant, first);
  /* Pushed, and the install still owed: somebody else's commit past it, so the install refuses to
     put a tree below the branch in the cache and the checkpoint stays where the push left it. */
  git(work, "fetch", "origin", BASE);
  git(work, "checkout", "-B", "past-it", meant);
  git(work, "commit", "--allow-empty", "-m", "somebody else's commit");
  git(work, "push", "origin", `past-it:${BASE}`);
  git(work, "checkout", BASE);
  issue().sessionContext.landing = { ...landing(), state: "promoted" };
  issue(NEXT_UUID).sessionContext.landing = {
    ...landing(NEXT_UUID), state: "reconciled", intended: "", release: "",
  };
  comments().length = 0;
  comments(NEXT_UUID).length = 0;
  forgetGateRuns();
  forgetInstall();
  const said = await ran([KEY, NEXT_KEY], work);
  assert.match(said, /that release is not installed yet/u, said);
  assert.equal(landing(NEXT_UUID).state, "reconciled", `nothing of it is written:\n${said}`);
  assert.ok(!landing(NEXT_UUID).intended, said);
  assert.equal(marks(NEXT_UUID).length, 0, `and no mark against a release nobody has:\n${said}`);
  assert.deepEqual(gateRuns(), [], `nor a candidate of its own for a change the base carries:\n${said}`);
});

/* The one place a member may not be dropped: past the chain, the candidate holds its head, so a
   drop there gates, pushes and installs its change with nothing on the issue saying so. */
test("a reconciliation the tracker refuses stops the whole set before anything is pushed", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true });
  const pinned = sha(work, BASE);
  seeded({ landing: ready(head, base), next: beside(next, base) });
  const kept = state.answer.forge_issues;
  state.answer.forge_issues = (args) => (args.action === "update" && args.documentId === UUID
    && args.data?.sessionContext?.landing?.state === "reconciled"
    ? { refused: "the tracker refused that reconciliation" }
    : kept(args));
  try {
    const said = await ran([KEY, NEXT_KEY], work);
    assert.match(said, /the tracker refused that reconciliation/u, said);
    assert.equal(remote(at), pinned, `nothing was pushed:\n${said}`);
    assert.equal(marks().length + marks(NEXT_UUID).length, 0, `and nothing marked:\n${said}`);
    assert.equal(landing(NEXT_UUID).state, "candidate", `the set stops where the save failed:\n${said}`);
  } finally {
    state.answer.forge_issues = kept;
  }
});

test("a key past its push is left out of the set and landed on its own, before any pre-push key", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true });
  seeded({ landing: ready(head, base), next: beside(next, base) });
  forgetInstall();
  const first = await ran([KEY], work);
  assert.equal(landing().state, "marked", first);
  /* Its release is on the branch and the mark is all it has left, which is no candidate's business. */
  issue().sessionContext.landing = { ...landing(), state: "installed" };
  comments().length = 0;
  const said = await ran([NEXT_KEY, KEY], work);
  assert.doesNotMatch(said, /as one candidate/u, `no set is formed of the two:\n${said}`);
  assert.ok(said.indexOf(`=== ${KEY}`) < said.indexOf(`=== ${NEXT_KEY}`),
    `and the one past its push goes first:\n${said}`);
  assert.equal(marks().length, 1, `whose mark is all it was owed:\n${said}`);
  /* And it is resumed into that alone: no candidate was built for it and no gate spent on it. */
  const its = said.slice(said.indexOf(`=== ${KEY}`), said.indexOf(`=== ${NEXT_KEY}`));
  assert.match(its, /step 9\/10/u, its);
  assert.doesNotMatch(its, /step 1\/10/u, its);
  assert.equal(landing(NEXT_UUID).state, "marked", `the ready branch landed after it:\n${said}`);
  assert.ok(holds(work, remote(at), next), said);
});
