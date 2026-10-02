/* The landing under a project that promotes to its live branch and deploys production on its own:
   nobody owes the release an act, and the release is still owed, by the batch the tracker cuts only
   for an issue resting at `awaiting_release`. So the walk stops there and names the batch, and the
   close is the batch's (ISS-2409). Its own file because the policy is read once per process. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  BASE, BUILDER, KEY, UUID,
  comments, context, ctx, earning, issue, ready, seeded, state, tracker, world,
} from "./fixture.mjs";
import { ranAsync } from "../../../../plugin/test/fixtures.mjs";

/* Before the first landing, the policy being memoised: production deploys on its own, and the move
   onto it is the release batch's. */
state.config = {
  baseBranch: BASE,
  releaseModel: "promote",
  liveBranch: "production",
  pipelineConfig: { autoProdDeploy: true },
};

const { landReady } = await import("../../../run/land-ready.mjs");
const { Stop } = await import("../../../checkout.mjs");
const { landingOf } = await import("../../../../plugin/src/flow/landing/checkpoint.mjs");
const { render } = await import("../../../../plugin/src/flow/record/page.mjs");
const { noteShown } = await import("../../../../plugin/src/tracker/comments.mjs");
const { markedCommit } = await import("../../../../plugin/src/flow/record/merged.mjs");

test.after(() => tracker.close());

const LANDER = process.env.FORGE_SESSION_ID;
const FORGE = new URL("../../../../plugin/bin/forge", import.meta.url).pathname;

/** The builder's own command, through the shipped verb, twice: the gate every write passes delivers
 *  a comment this session has not read and refuses once. */
const asBuilder = async (argv) => {
  let run = null;
  for (const again of [1, 2]) {
    run = await ranAsync(FORGE, argv, { ...process.env, FORGE_SESSION_ID: BUILDER }, process.cwd());
    if (run.status === 0 || again === 2) return run;
  }
  return run;
};

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

test("a promotion the project deploys on its own rests at the rung for the release batch", async () => {
  const { work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base), earned: earning(head) });
  const first = await ran([KEY], work);
  assert.equal(landing().state, "records-owed", `the mark is up and the deploying rung is not earned:\n${first}`);
  const landed = markedCommit(comments(UUID));
  assert.ok(landed, `the mark names the sha this landing pushed:\n${first}`);
  verified(landed);
  const took = await asBuilder(["claim", KEY, "--take"]);
  assert.equal(took.status, 0, `${took.stdout}${took.stderr}`);
  const back = await asBuilder(["claim", KEY, "--recorded"]);
  const said = `${back.stdout}${back.stderr}`;
  assert.equal(back.status, 0, said);
  assert.equal(issue().status, "awaiting_release", `the walk took the close the release batch is owed:\n${said}`);
  assert.deepEqual(moves(), ["developed", "testing", "awaiting_release"],
    `the walk stops at the rung and no further:\n${said}`);
  assert.equal(landing().state, "done", `and nothing of the landing is left:\n${said}`);
  assert.match(said, new RegExp(`${KEY} rests at \`awaiting_release\`: the promotion from ${BASE} to production is the release batch's`, "u"),
    `the rest names the batch it waits for:\n${said}`);
  assert.match(said, new RegExp(`forge release-batch record ${KEY} --commit `, "u"),
    `and the record that closes it after a promotion outside a batch:\n${said}`);
  assert.doesNotMatch(said, /--set closed/u, `a person's set is offered where nobody owes one:\n${said}`);
});
