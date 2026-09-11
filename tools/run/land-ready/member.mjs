/* One issue's side of a landing: the record a step reads of it, the way a set spends a step on each
   of its members, the mark the release earns it and the statuses its own record earns. What a set may
   hold, and why these are the only steps it spends per member: docs/cli/the-checkpoint.md. */
import { stop, Stop } from "../../checkout.mjs";
import { shortly } from "../install.mjs";
import { Refusal, refusing } from "../../../plugin/src/resolve/settings.mjs";
import { Refused } from "../../../plugin/src/refusal.mjs";
import { commentPage } from "../../../plugin/src/tracker/comments.mjs";
import { scoped } from "../../../plugin/src/tracker/rest.mjs";
import { advance } from "../../../plugin/src/flow/advance.mjs";
import { ORDER, atLeast, viewFrom } from "../../../plugin/src/flow/earned.mjs";
import { CLOSES_FROM } from "../../../plugin/src/flow/machine.mjs";
import { markMerged, markNote, markedCommit, namedFor } from "../../../plugin/src/flow/record/merged.mjs";
import { LANDING_DONE, LANDING_JUDGED, LANDING_QA_OWED, landingSaved } from "../../../plugin/src/flow/lease.mjs";
import { INDEPENDENT, judgedAt } from "../../../plugin/src/flow/qa/verdicts.mjs";
import { personOwedForRelease, releasePolicy } from "../../../plugin/src/tracker/project-config.mjs";

const BEFORE_MERGE = "before-merge";
export const DEVELOPED = "developed";
const RUNGS = ORDER.slice(ORDER.indexOf(DEVELOPED) + 1);
export const [JUDGED] = RUNGS;

/* How far a member goes: through the close only where the release owes a person no act (ISS-1147). */
const walkedWhere = (owed) => (owed ? RUNGS.slice(0, RUNGS.indexOf(CLOSES_FROM) + 1) : RUNGS);

/* `fail` in the CLI's own modules exits, dropping the lock and leaving a branch promoted in silence. */
export const asked = async (run) => {
  try {
    return await refusing(run);
  } catch (error) {
    if (error instanceof Refusal || error instanceof Refused) return stop(error.message);
    throw error;
  }
};

export const saveOn = async (member, patch) => {
  member.landing = await asked(() => landingSaved(member.documentId, member.key, patch));
  return member.landing;
};

export const keysOf = (at) => at.members.map((one) => one.key).join(" ");

export const releaseOf = (at) => at.release ?? at.members[0].landing.release;

export const intendedOf = (at) => at.intended ?? at.members[0].landing.intended;

/* Where a death inside the promoting loop left a member out of the record, its head being in the
   release pushed anyway: each is the reading of that, walked because the table refuses the jump. */
export const caughtUp = async (member, intended, release) => {
  await saveOn(member, { state: "promoting", intended, release });
  await saveOn(member, { state: "promoted" });
  await saveOn(member, { state: "installed" });
};

/* Before the push a member's own failure takes it out of the set and the rest go on, the branch
   beside it being somebody else's release; a set of one is the landing's own stop, as it always was.
   A member owed a landing of its own says so by marking itself `again` before it stops. */
export const perMember = async (at, run) => {
  for (const member of [...at.members]) {
    try {
      await run(member);
    } catch (error) {
      if (!(error instanceof Stop) || at.members.length === 1) throw error;
      console.error(`  ${member.key} is out of this landing: ${error.message}`);
      at.members = at.members.filter((one) => one !== member);
      at.dropped.push(member);
      process.exitCode = 1;
    }
  }
  if (at.members.length === 0) {
    stop(`every branch this landing took is out of it, so there is no candidate to land. What each `
      + `of them is owed is above.`);
  }
};

/* After the push nothing is out of the landing: every member holds the release that went out, so a
   stop is what that member is owed and no reason to shorten the set. */
export const perMemberOwed = async (at, run) => {
  for (const member of [...at.members]) {
    try {
      await run(member);
    } catch (error) {
      if (!(error instanceof Stop) || at.members.length === 1) throw error;
      console.error(`  ${member.key}: ${error.message}`);
      process.exitCode = 1;
    }
  }
};

/* The whole record, policy and all, for the steps that need one rather than a field or the page. */
export const viewOf = async (documentId) => {
  const [issue, page, release] = await Promise.all([
    scoped("forge_issues", { action: "get", documentId }), commentPage(documentId), releasePolicy(),
  ]);
  return viewFrom(documentId, issue, page.comments ?? [], null, release);
};

/* The verdicts a moved base or head takes away, named rather than described. Empty where the project
   asks for no independent judge: a builder's verdicts are the review at the landed head's business. */
export const voidSaid = async (documentId, landing) => {
  if (!landing.deployment) return "";
  const view = await asked(() => viewOf(documentId));
  const numbers = judgedAt(landing, view.verdicts, view.release);
  return numbers.length
    ? ` The QA verdict(s) on criterion ${numbers.join(", ")} judged ${shortly(landing.deployment)} and `
      + `are void with it.`
    : "";
};

const statusOf = async (documentId) =>
  (await scoped("forge_issues", { action: "get", documentId, fields: ["status"] }))?.status ?? null;

export const notReconciled = (key, landing, candidate, moved = []) =>
  `the checkpoint on ${key} reads \`${landing.state}\` and its reconciliation names `
  + `${shortly(landing.reconciled) || "no candidate"}, not the candidate this landing built at `
  + `${shortly(candidate)}${moved.length ? `, which moved ${moved.join(", ")}` : ""}. Nothing is `
  + `promoted against a reading of another candidate${moved.length
    ? `: the branch is the builder's again.\n    forge claim ${key} --take` : "."}`;

/* A commit on both routes, and the one a verdict cites: `judgeProblem` reads it again at the rung. */
export const OWED_TO_QA = (key, landing, what) =>
  `the checkpoint on ${key} reads \`${LANDING_QA_OWED}\`: ${what} at ${shortly(landing.deployment)} is `
  + `what an independent judge is owed, and nothing of ${key} moves until the turn comes back.\n`
  + `    forge claim ${key} --take\n`
  + `    ... the verdicts, then: forge claim ${key} --judged`;

export const markStep = async (one) => {
  const { at, ctx: { base } } = one;
  const landed = intendedOf(at);
  await perMemberOwed(at, async (member) => {
    const { key, documentId, landing } = member;
    const { comments } = await asked(() => commentPage(documentId));
    if (markedCommit(comments ?? []) === landed) {
      console.log(`  the mark at ${shortly(landed)} is up already`);
    } else {
      const judged = landing.moved ? landing.candidate : landing.head;
      const named = await asked(() => namedFor(documentId, comments ?? []));
      /* Through `asked` because the composer refuses: a note it cannot fit under the tracker's cap is a correction this issue owes, and the run reads it as this step's own stop with the resume line under it rather than as an exception thrown past a landing that has already pushed. */
      const note = await asked(() => markNote({
        branch: base,
        at: landed,
        reviewed: judged,
        judged,
        moved: landing.moved ? landing.moved.split(", ") : [],
        wrote: landing.files,
        named,
        ref: key,
      }));
      await asked(() => markMerged(documentId, key, note));
      console.log(`  ${key} is marked merged at ${shortly(landed)}`);
    }
    await saveOn(member, { state: "marked" });
  });
};

/* Driven through `advance`, so the flow table and the entry criteria stay where they live, and read
   for whether the status is there rather than for whether the move was tried: an advance refused
   says so and moves nothing, and `done` written over that would certify a status nothing earned. */
const moveTo = async (key, to, documentId) => {
  const status = await asked(() => statusOf(documentId));
  if (atLeast(status, to)) {
    console.log(`  ${key} is ${status} already`);
    return true;
  }
  try {
    await refusing(() => advance([key, "--to", to]));
  } catch (error) {
    if (!(error instanceof Refusal || error instanceof Refused)) throw error;
    console.error(`  ${key} stays ${status}: ${error.message}`);
    return false;
  }
  return atLeast(await asked(() => statusOf(documentId)), to);
};

export const statusStep = async (one) => {
  const { at, ctx: { route, judgement, policy } } = one;
  const owed = personOwedForRelease(policy);
  await perMemberOwed(at, async (member) => {
    const { key, documentId, landing } = member;
    await moveTo(key, DEVELOPED, documentId);
    /* The other place the route puts that turn; the release is what says what is running. */
    if (judgement === INDEPENDENT && route !== BEFORE_MERGE && landing.state !== LANDING_JUDGED) {
      await saveOn(member, { state: LANDING_QA_OWED, deployment: intendedOf(at) });
      return stop(OWED_TO_QA(key, member.landing, "the release"));
    }
    /* One rung at a time up the tail, a jump being refused, and `done` refused to every turn so it
       waits on the last of them: closed over a record that did not earn a rung, the issue would be
       reachable by no route at all. A rung the record does not earn stops the walk where it stands. */
    for (const rung of walkedWhere(owed)) {
      if (!await moveTo(key, rung, documentId)) {
        return console.log(`  the checkpoint stays \`${landing.state}\`: what \`${rung}\` is owed is `
          + `above, and the landing is run again once the record carries it`);
      }
    }
    if (owed) {
      console.log(`  ${key} rests at \`${CLOSES_FROM}\`: ${owed}, so the close is theirs and not this `
        + `landing's. Once the release is out:\n    forge advance ${key}`);
    }
    await saveOn(member, { state: LANDING_DONE });
    return console.log(`  the checkpoint reads \`${LANDING_DONE}\`: no turn of this landing is left`);
  });
};
