/* What a second landing finishes. A run dies wherever it dies, and every state the checkpoint can
   hold is a resume: the table below is the five points a death is worst at, and each row's whole
   claim is that exactly what is owed is done — one release on the branch and one mark on the issue,
   never two of either. Beside them, the span the lock covers and the install that must not go
   backwards, both of which are about two landings on one machine rather than one (ISS-673). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BASE, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, NEXT_UUID, PROBE_GATE, RECORD,
  claudeCalls, comments, context, ctx, forgetInstall, forgetProbe, git, installedAt, issue, marks, probeInInstall,
  probeOnce, probeSaid, ready, seeded, serverPushes, sha, state, strayWrites, tracker, world,
} from "./fixture.mjs";

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

const landing = (documentId = undefined) => landingOf(context(documentId));
const remote = (at) => sha(join(at, "origin.git"), `refs/heads/${BASE}`);
const transitions = () => state.calls.filter((one) => one.args.action === "transition").length;

/* Where the death was, what the world looks like after it, and the line that says the write it
   guards was found already done. `installs` is whether the resume is owed the `claude` calls. */
const DEATHS = [
  {
    name: "after the push, before the `promoted` save",
    state: "promoting",
    says: /this release landed and the save after it did not/u,
    installs: false,
  },
  {
    name: "after `promoted`, with the install still owed",
    state: "promoted",
    forget: true,
    says: /is installed, from/u,
    installs: true,
  },
  {
    name: "after the install, before the `installed` save",
    state: "promoted",
    says: /is installed already, so this install is owed nothing/u,
    installs: false,
  },
  {
    name: "after the mark, before the `marked` save",
    state: "installed",
    says: /the mark at [0-9a-f]{7} is up already/u,
    installs: false,
  },
  {
    name: "after the `developed` move",
    state: "marked",
    status: "developed",
    says: /is developed already/u,
    installs: false,
  },
];

for (const row of DEATHS) {
  test(`a second landing after a death ${row.name} finishes only what is owed`, async () => {
    const { at, work, head, base } = world({ base: "other" });
    seeded({ landing: ready(head, base) });
    const first = await ran([KEY], work);
    assert.equal(landing().state, "marked", `the landing this row rewinds:\n${first}`);
    const release = remote(at);
    const held = landing();
    /* The world as the death left it: the checkpoint back at that state, and where the death was
       before the write itself, whatever that write had produced taken away again. */
    issue().sessionContext.landing = { ...held, state: row.state };
    if (row.status) issue().status = row.status;
    if (row.forget) forgetInstall();
    const before = { calls: claudeCalls().length, moves: transitions() };
    const said = await ran([KEY], work);
    assert.match(said, row.says, said);
    assert.equal(remote(at), release, `one release and no second one:\n${said}`);
    assert.equal(marks().length, 1, `one mark and no second one:\n${said}`);
    assert.equal(landing().state, "marked", `and the landing is where it was:\n${said}`);
    assert.equal(landing().intended, held.intended, `against the release it already made:\n${said}`);
    assert.equal(claudeCalls().length > before.calls, row.installs, `the install was ${row.installs ? "" : "not "}owed:\n${said}`);
    if (row.status) assert.equal(transitions(), before.moves, `and no status moved again:\n${said}`);
    assert.deepEqual(strayWrites(), [], `a resume writes nothing the landing may not:\n${said}`);
  });
}

/* `judged` names the QA turn's hand-back either side of a promotion, so a checkpoint at it may be
   past its own push. Resumed at the pin, the second reading of a landed release is a moved base —
   and voiding there would build another release of a change already out. */
test("a checkpoint at `judged` past its own push rebuilds nothing and releases nothing twice", async () => {
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  const first = await ran([KEY], work);
  assert.equal(landing().state, "marked", first);
  const release = remote(at);
  const held = landing();
  /* What the QA turn writes when it has read the release: the lander's own last state, judged. */
  issue().sessionContext.landing = { ...held, state: "judged" };
  const said = await ran([KEY], work);
  /* The intended sha names this as the hand-back after a promotion, so the status is all that is owed. */
  assert.match(said, /step 10\/10/u, said);
  assert.doesNotMatch(said, /step 1\/10/u, `nothing was pinned or built again:\n${said}`);
  assert.equal(remote(at), release, `one release and no second one:\n${said}`);
  assert.equal(marks().length, 1, `and one mark:\n${said}`);
  const after = landing();
  /* Neither status is earned here, so the checkpoint is not closed over one; earned, it reads `done`. */
  assert.equal(after.state, "judged", `left where the record leaves it:\n${said}`);
  assert.match(said, /the checkpoint stays `judged`/u, said);
  assert.equal(after.intended, held.intended, `with the release it names intact:\n${said}`);
  assert.equal(after.candidate, held.candidate, `and its candidate not voided:\n${said}`);
});

test("a base head this checkout cannot read voids nothing and releases nothing twice", async () => {
  const { at, work, head, base } = world({ base: "other" });
  const pinned = sha(work, BASE);
  /* The release this landing made, as a commit nothing here holds: the same reading a head pushed
     between the fetch and the read gives, and the one no ancestry test can answer. */
  const gone = "0".repeat(39).concat("1");
  seeded({
    landing: ready(head, base, {
      state: "promoting", pinned, candidate: head, reconciled: head, intended: gone, release: "1.0.1",
    }),
  });
  const said = await ran([KEY], work);
  assert.match(said, /cannot read that commit or the release/u, said);
  assert.equal(landing().state, "promoting", `the checkpoint is left as it was:\n${said}`);
  assert.equal(landing().intended, gone, `its release still named:\n${said}`);
  assert.equal(remote(at), pinned, `and nothing was pushed:\n${said}`);
});

test("a branch past this release with nothing newer installed refuses rather than certifying one", async () => {
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  const first = await ran([KEY], work);
  assert.equal(landing().state, "marked", first);
  const release = landing().intended;
  /* The death is before the install; then somebody else moves the branch and installs nothing —
     a plain `land` does exactly that. */
  issue().sessionContext.landing = { ...landing(), state: "promoted" };
  comments().length = 0;
  forgetInstall();
  const later = serverPushes(at, "1.0.9");
  const said = await ran([KEY], work);
  assert.match(said, /the newest install record holds nothing for this plugin/u, said);
  assert.equal(landing().state, "promoted", `it stays where it was:\n${said}`);
  assert.equal(marks().length, 0, `and nothing is marked:\n${said}`);
  /* Once a copy carrying it is installed, the rest of the landing is owed and the install is not. */
  installedAt("1.0.9");
  const before = claudeCalls().length;
  const after = await ran([KEY], work);
  assert.match(after, new RegExp(`past this release at ${release.slice(0, 7)}`, "u"), after);
  assert.equal(claudeCalls().length, before, `nothing was installed over the newer copy:\n${after}`);
  /* A release this one is past releases nothing, so it publishes nothing and does not so much as ask: the head in the root is the other landing's, and offering it here would file that head under this release's version (ISS-1101). */
  assert.doesNotMatch(after, /nothing is published for/u,
    `the publisher was offered a head this resume did not release:\n${after}`);
  assert.equal(marks().length, 1, `and the mark it owed is up:\n${after}`);
  assert.equal(landing().state, "marked", after);
  assert.equal(remote(at), later, `the branch is still where the other landing left it:\n${after}`);
});

test("nothing else takes the landing's lock between the pin and the end of the install", async () => {
  const { work, head, base } = world({ base: "other", gate: PROBE_GATE });
  seeded({ landing: ready(head, base) });
  forgetProbe();
  /* The install has to really run, or the far end of the span is never reached to be read: a record
     another case in this file left behind would let this one skip it. */
  forgetInstall();
  probeInInstall(work);
  const said = await ran([KEY], work);
  /* One try from the gate and one from each call the install makes, so more than one is what says
     the span reached both ends of it rather than only its first step. */
  const tried = probeSaid();
  assert.ok(tried.length > 1, `the gate and the install each tried for it:\n${said}\n${tried.join("\n")}`);
  for (const one of tried) assert.match(one, /^waited/u, `the lock was held: ${one}`);
  /* And dropped where the roles say: the same probe takes it once the install has completed. */
  assert.match(probeOnce(work), /^took it/u, "the lock is free after the landing");
});

test("an install of an older release never overwrites the newer installed copy", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true });
  seeded({
    landing: ready(head, base),
    next: ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }),
  });
  installedAt("9.9.9");
  const said = await ran([KEY, NEXT_KEY], work);
  assert.match(said, /9\.9\.9/u, said);
  assert.match(said, /would put the older copy in the cache/u, said);
  const record = JSON.parse(readFileSync(RECORD, "utf8"));
  assert.deepEqual(Object.values(record.plugins).flat().map((one) => one.version), ["9.9.9"],
    `the newer copy still stands:\n${said}`);
  assert.notEqual(remote(at), base, `the release landed — it is the install that is refused:\n${said}`);
  assert.equal(marks().length, 0, `and nothing is marked past a half-done install:\n${said}`);
  assert.equal(landing().state, "promoted", `the checkpoint says where it stopped:\n${said}`);
  /* An install entered and not finished is the machine's, not this branch's, so nothing runs past
     the refusal — and these two are on one candidate, so the branch beside it waits where it does. */
  assert.match(said, /Read it and put back what it names before any other branch lands/u, said);
  assert.equal(landing(NEXT_UUID).state, "promoted", `the branch beside it stops there too:\n${said}`);
  assert.equal(marks(NEXT_UUID).length, 0, `and nothing of it is marked:\n${said}`);
});

test("a checkpoint whose turn is not the lander's is refused before any write", async () => {
  const { work, head, base } = world({ base: "other" });
  const owed = ready(head, base, { state: "builder-owed", moved: "plugin/src/one.mjs", candidate: head });
  seeded({ landing: owed });
  const said = await ran([KEY], work);
  assert.match(said, /reads `builder-owed`/u, said);
  assert.deepEqual(landingOf(context()), landingOf({ landing: owed }), `nothing was written:\n${said}`);
  assert.equal(state.calls.filter((one) => one.args.action === "update").length, 0, said);
});

test("an issue with no checkpoint at all is refused naming the command that writes one", async () => {
  const { at, work, next, base } = world({ base: "other", second: true });
  const pinned = sha(work, BASE);
  seeded({ next: ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }) });
  /* The record a case above left behind holds a version past this one, which the install refuses. */
  forgetInstall();
  const said = await ran([KEY, NEXT_KEY], work);
  assert.match(said, /carries no landing checkpoint/u, said);
  assert.match(said, /forge claim ISS-673 --pushed --ready/u, said);
  assert.equal(git(work, "status", "--porcelain").stdout, "", "and nothing was edited");
  /* And the key after it still lands: a checkpoint this task cannot carry ends one branch's landing. */
  assert.equal(landing(NEXT_UUID).state, "marked", said);
  assert.notEqual(remote(at), pinned, `the branch after it was promoted:\n${said}`);
});
