/* Step 4 of land-ready, the gate over the candidate, and the question the steps around it share: whether a member's
   state may still be handed back to its builder. Its own file because the landing's is at its line limit, and because
   this is the step whose wait for a gate place is ISS-2461's. */
import { spawnSync } from "node:child_process";

import { stop, Stop } from "../../checkout.mjs";
import { DECLINED, LANDING_ENV } from "../../gates/machine.mjs";
import { LANDING_WAIT_ENV } from "../../gates/landing/wait.mjs";
import { shortly } from "../install.mjs";
import { roomFor } from "./candidate.mjs";
import { keysOf, saveOn } from "./member.mjs";
import { LANDING_HEAD_OWED, RECAPTURE, landingNext } from "../../../plugin/src/flow/landing/checkpoint.mjs";

/** Whether the table leads this member's state to the builder's new head: past a judgement it does
    not, and a stop there says what it met without writing a move the save would refuse. */
export const handsBack = (member) => landingNext(member.landing, LANDING_HEAD_OWED) === null;

/* Spent on the combination and on no subset of it: what the branches are landed as instead, and the
   runs that bounds, is the-checkpoint.md's. The minutes are the landing's `--wait`, the one number both of
   its waits take: a landing stopped for a place it was never asked to wait for is the person in the loop
   G-11 rules out (ISS-2461). */
export const gateStep = async (one) => {
  const { at, ctx: { root, ms, self } } = one;
  at.room = roomFor(root, at.candidate);
  const minutes = ms / 60_000;
  const env = { ...process.env, [LANDING_ENV]: keysOf(at), [LANDING_WAIT_ENV]: String(minutes) };
  const run = spawnSync("npm", ["run", "check"], { cwd: at.room, encoding: "utf8", stdio: "inherit", env });
  /* A gate that never ran says nothing about any branch, so nothing is handed to anybody over it. */
  if (run.error) stop(`npm could not be run: ${run.error.message}. Nothing of any branch was judged.`);
  if (run.status === 0) return;
  /* Declined for want of a place, the gate ran no step either, so no set is split and no branch handed back over it. */
  if (run.status === DECLINED) {
    const declined = new Stop(`npm run check waited ${minutes} minute(s) for a gate place for the candidate `
      + `${shortly(at.candidate)}, ahead of every builder's gate, and none freed, so it ran no step: no branch of `
      + `${keysOf(at)} was judged and nothing was handed back, and each checkpoint is still the landing's turn. `
      + `Land again with a longer wait:\n    ${self} land-ready ${keysOf(at)} `
      + `--wait ${minutes * 2}`);
    declined.exitCode = DECLINED;
    throw declined;
  }
  const said = `npm run check exited ${run.status} over the candidate ${shortly(at.candidate)}.`;
  if (at.members.length > 1) {
    at.split = true;
    stop(`${said} ${keysOf(at)} are green apart and red together, and the gate says nothing about `
      + `which of them the combination is. No subset is searched for: every reading taken at this `
      + `candidate is void and each branch is landed alone, against the base as it moves, so the one `
      + `that fails there fails on its own account and the failing step goes back to whoever built it.`);
  }
  /* The branch's own fault against what landed since, answered by a new head: the one the gate
     refused stays where it is, the landing writing no ref of a branch it did not build. */
  const [member] = at.members;
  if (!handsBack(member)) {
    stop(`${said} The checkpoint on ${member.key} reads \`${member.landing.state}\`, past the states a `
      + `branch is handed back from, so nothing of it moved. Read where it is:\n    forge resume ${member.key}`);
  }
  await saveOn(member, { state: LANDING_HEAD_OWED });
  stop(`${said} The candidate is ${member.landing.branch} merged onto what landed since, so the `
    + `failure is that branch's own and it goes back to the run that built it: the checkpoint is at `
    + `\`${LANDING_HEAD_OWED}\`, and nothing of ${member.key} is pushed or installed. That run commits `
    + `the answer on top of ${shortly(member.landing.head)} and captures the head it makes:\n`
    + RECAPTURE(member.key, "    "));
};
