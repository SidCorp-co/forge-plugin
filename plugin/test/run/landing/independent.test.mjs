/* The landing on the route the rest of this directory never takes: production deploys off the base,
   so the judgement is owed before the push, and the project asks for a judge who is not the builder.
   Its own file because the policy is read once per process — every case in `land-ready.test.mjs`
   runs after-merge asking for no judge, which is how this whole route shipped green (ISS-673). */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import {
  BASE, KEY, UUID, comments, context, ctx, issue, marks, ready, seeded, serverPushes, sha, state,
  strayWrites, tracker, world,
} from "./fixture.mjs";

/* Before the first landing runs, because the policy is memoised: the base is the production branch
   and deploys are automatic, which is what derives route `before-merge`. */
state.config = {
  baseBranch: BASE,
  productionBranch: BASE,
  pipelineConfig: { autoProdDeploy: true, qa: "independent" },
};

const { landReady } = await import("../../../../tools/run/land-ready.mjs");
const { Stop } = await import("../../../../tools/checkout.mjs");
const { landingOf } = await import("../../../src/flow/lease.mjs");
const { render } = await import("../../../src/flow/record/page.mjs");

test.after(() => tracker.close());

const QA = "the-qa-run";

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

/** A judge's verdict as `forge record verdict` renders one: another session's id, and the deployment cited off the evidence rather than the commit. */
const judged = (numbers, evidence, commit) => {
  comments(UUID).push({
    documentId: `verdict-${numbers.join("-")}`,
    createdAt: new Date().toISOString(),
    body: render("verdict", numbers.map((number) => ({
      criterion: `${number} — the outcome`, verdict: "pass", commit, evidence: [evidence], judge: QA,
    }))),
  });
};

test("the candidate is built and gated, and the push waits on a judge the checkpoint names", async () => {
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  const said = await ran([KEY], work);
  assert.match(said, /landing before-merge, judgement independent/u, said);
  const held = landing();
  /* Everything up to the push is paid before the turn is handed over: judging a candidate that had
     not been gated would spend a judge's pass on a tree the gate might still refuse. */
  assert.equal(held.state, "qa-owed", `the turn is the judge's:\n${said}`);
  assert.ok(held.candidate, `and a candidate was built for it to judge:\n${said}`);
  assert.equal(held.deployment, held.candidate,
    "the identity a verdict cites is the candidate, this route's deployment being the unpushed commit");
  assert.equal(remote(at), base, `nothing is pushed while the judgement is owed:\n${said}`);
  assert.equal(marks().length, 0, `and no mark says it landed:\n${said}`);
  assert.equal(issue().status, "in_progress", `and no status moved:\n${said}`);
  assert.match(said, new RegExp(`forge claim ${KEY} --take`, "u"), said);
  assert.match(said, new RegExp(`forge claim ${KEY} --judged`, "u"),
    `both moves of the turn are in the refusal, which is all a run has to act on:\n${said}`);
  assert.deepEqual(strayWrites(), [], `and the landing wrote nothing else:\n${said}`);
});

test("the turn handed back at the candidate it was given releases the push it was holding", async () => {
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  const first = await ran([KEY], work);
  assert.equal(landing().state, "qa-owed", first);
  const { candidate } = landing();
  /* What `forge claim --judged` leaves, whose own refusals are the claim's tests: the state, and the
     judge named on it. The landing reads it and carries on from the step it stopped at. */
  issue().sessionContext.landing = { ...landing(), state: "judged", judge: QA };
  const said = await ran([KEY], work);
  assert.match(said, new RegExp(`judged at ${candidate.slice(0, 7)}`, "u"),
    `the judgement is read as this candidate's own:\n${said}`);
  assert.notEqual(remote(at), base, `the base moved, so the release was pushed:\n${said}`);
  assert.equal(marks().length, 1, `and the mark says it landed:\n${said}`);
  assert.equal(landing().intended, remote(at), `at the sha the landing intended:\n${said}`);
});

/* The case the route exists for: what was judged is not what would be promoted, so the push is not
   released and the readings taken at the candidate given up are named to whoever judges again. */
test("a judgement over a candidate the landing no longer holds is voided by the numbers it names", async () => {
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  await ran([KEY], work);
  const gone = landing().candidate;
  judged([1, 2], gone, head);
  /* The base moves under the judgement, which is what makes it stale: what is built over the new pin is not the commit the verdicts cite. */
  const moved = serverPushes(at, "1.0.5");
  issue().sessionContext.landing = { ...landing(), state: "judged", judge: QA };
  const held = await ran([KEY], work);
  assert.match(held, /has not been shown/u, `the judgement is delivered before it is spent:\n${held}`);
  const said = await ran([KEY], work);
  assert.match(said, /QA verdict\(s\) on criterion 1, 2/u,
    `the judge is owed the list rather than a description of the loss:\n${said}`);
  assert.match(said, new RegExp(`judged ${gone.slice(0, 7)}`, "u"),
    `and every number named judged the identity given up:\n${said}`);
  const after = landing();
  assert.equal(after.state, "qa-owed", `the judgement is asked for again:\n${said}`);
  assert.notEqual(after.deployment, gone, `over the candidate rebuilt on the base that moved:\n${said}`);
  assert.equal(remote(at), moved, `and nothing of the change was released on the way:\n${said}`);
  assert.equal(marks().length, 0, `nor marked as landed:\n${said}`);
});

/* A void clears the release and the sha meant for the push, so a landing resumed at `judged` after
   one pins and builds again. Told apart by `release`, that resume ran step ten alone: nothing landed,
   no mark was written and no state named a turn that could move it, short of an edit by hand. */
test("a judgement with no intended sha is the turn before the push, so the landing resumes at the pin", async () => {
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base) });
  await ran([KEY], work);
  issue().sessionContext.landing = {
    ...landing(), state: "judged", judge: QA, release: "9.9.9", intended: "",
  };
  const said = await ran([KEY], work);
  assert.match(said, /step 1\/10/u, `the landing pins and builds again:\n${said}`);
  assert.match(said, /step 7\/10/u, `and reaches the push it had not made:\n${said}`);
  assert.notEqual(remote(at), base, `so the change lands rather than parking for good:\n${said}`);
  assert.equal(marks().length, 1, `with the mark that says it did:\n${said}`);
});

test("a void leaves no release on the checkpoint for a later resume to read as a push", async () => {
  const { work, head, base } = world({ base: "moved" });
  seeded({ landing: ready(head, base) });
  const said = await ran([KEY], work);
  const after = landing();
  assert.ok(!after.release, `a voided checkpoint names no release:\n${JSON.stringify(after)}\n${said}`);
  assert.ok(!after.intended, `and no sha it intended to push:\n${said}`);
});
