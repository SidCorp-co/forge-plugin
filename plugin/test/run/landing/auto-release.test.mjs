/* The landing under a project whose release owes a person nothing: it walks the last rung too and
   the issue reaches `closed` untouched. Its own file because the policy is read once per process
   and every other case here runs a branch deploying nothing, so they prove the other ceiling. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  BASE, KEY, UUID,
  comments, context, ctx, earning, issue, ready, seeded, state, tracker, world,
} from "./fixture.mjs";

/* Before the first landing, the policy being memoised: the promotion is the project's own. */
state.config = {
  baseBranch: BASE,
  productionBranch: "production",
  pipelineConfig: { autoProdDeploy: true },
};

const { landReady } = await import("../../../../tools/run/land-ready.mjs");
const { Stop } = await import("../../../../tools/checkout.mjs");
const { landingOf } = await import("../../../src/flow/lease.mjs");
const { render } = await import("../../../src/flow/record/page.mjs");
const { noteShown } = await import("../../../src/tracker/comments.mjs");
const { markedCommit } = await import("../../../src/flow/record/merged.mjs");

test.after(() => tracker.close());

const LANDER = process.env.FORGE_SESSION_ID;

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

const landing = () => landingOf(context());
const moves = () =>
  state.calls.filter((one) => one.args?.action === "transition").map((one) => one.args.data.status);

/** The verification an automatic release owes (ISS-428): the sha the deployment built, which is
 *  the one this landing pushed. Credited as delivered, the thread's own gate being another rule's. */
const verified = (at) => {
  comments(UUID).push({
    documentId: "verification-at-the-landed-sha",
    createdAt: new Date().toISOString(),
    body: render("verification", { where: "the installed plugin", commit: at, evidence: ["https://ci.example.test/11"] }),
  });
  noteShown(LANDER, UUID, comments(UUID));
};

test("a release the project makes without a person is closed by the landing that made it", async () => {
  const { work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base), earned: earning(head) });
  /* It stops at the judging rung first: the fixture's verification cites the head, not what shipped. */
  const first = await ran([KEY], work);
  assert.equal(landing().state, "marked", `the mark is up and the deploying rung is not earned:\n${first}`);
  const landed = markedCommit(comments(UUID));
  assert.ok(landed, `the mark names the sha this landing pushed:\n${first}`);
  verified(landed);

  const said = await ran([KEY], work);
  assert.equal(issue().status, "closed", `the landing took the last rung itself:\n${said}`);
  assert.equal(landing().state, "done", `and nothing of it is left:\n${said}`);
  assert.deepEqual(moves(), ["developed", "testing", "awaiting_release", "closed"],
    `one move per rung of the tail, in the table's order, and no jump:\n${said}`);
  assert.doesNotMatch(said, /rests at `awaiting_release`/u,
    `nothing is left for a person, so nothing says a person is owed:\n${said}`);
});
