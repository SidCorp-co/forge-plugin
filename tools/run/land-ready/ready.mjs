/* The keys a landing takes. Found: what this project left ready, off the checkpoints rather than off
   git or a branch name, so the verb named for what is ready stops asking the caller to already know
   it. Named: the keys typed, each with the batch it brings. docs/cli/the-checkpoint.md. */
import { stop } from "../../checkout.mjs";
import { asked } from "./member.mjs";
import { ORDER as RUNGS, SIDE } from "../../../plugin/src/flow/earned.mjs";
import { landingOf } from "../../../plugin/src/flow/landing/checkpoint.mjs";
import { batchAgrees, membersOf } from "../../../plugin/src/flow/lease/batch.mjs";
import { worklogOf } from "../../../plugin/src/flow/worklog.mjs";
import { shortly } from "../install.mjs";
import { everyIssue, shortOf } from "../../../plugin/src/tracker/issues.mjs";
import { scoped } from "../../../plugin/src/tracker/rest.mjs";

/* `sessionContext` is in no list projection, so each candidate costs a get and the set is bounded
   first: a landing still owing its pin has not run its own status step, so the issue stands where the
   build left it. Printed, because a landing past its pin moves the status out of this bound. */
const BAND = [...RUNGS.slice(RUNGS.indexOf("in_progress"), RUNGS.indexOf("closed")), ...SIDE];

const SHORT = (said, self) =>
  `${said}\nSo nothing here knows what this project left ready, and no batch is built on a read that `
  + `came back short. Name the branches this landing is to take:\n    ${self} land-ready ISS-45`;

const NOTHING = (self, seen) =>
  `no checkpoint at the statuses above reads a state this landing would start at the pin from, so `
  + `there is nothing here ready to land${seen ? `: the ${seen} above name another turn or another `
    + `step` : ""}. A build writes one where it ends, and a landing past its pin is named rather than `
  + `found:\n    forge claim ISS-45 --pushed --ready\n    ${self} land-ready ISS-45`;

/* Oldest capture first, the order a caller wanting this candidate would have typed; no stamp sorts last. */
const LAST = "￿";
const numbered = (key) => Number(String(key).replace(/\D+/gu, "")) || 0;
const inOrder = (found) => [...found].sort((one, two) =>
  (one.landing.at || LAST).localeCompare(two.landing.at || LAST) || numbered(one.key) - numbered(two.key));

const foundIn = async (rows) => {
  const out = [];
  for (const row of rows) {
    const issue = await asked(() => scoped("forge_issues",
      { action: "get", documentId: row.documentId, fields: [] }));
    const landing = landingOf(issue?.sessionContext ?? null);
    if (landing) out.push({ key: row.issueId, landing });
  }
  return inOrder(out);
};

const shown = (found, taking, self) => {
  console.log(`\nwhat this project left ready, off the checkpoints of every issue at ${BAND.join(", ")}:`);
  for (const one of found) {
    const at = `${one.key}  \`${one.landing.state}\`  ${one.landing.branch || "no branch"}`;
    console.log(taking.includes(one)
      ? `  ${at}  — this landing's`
      : `  ${at}  — left out: read where it is, forge resume ${one.key}`);
  }
  if (!taking.length) return;
  console.log(`  handed to the landing in that order, which schedules them as it would a call typing `
    + `the same keys; a different set, or a different order, is the caller's to type:\n`
    + `    ${self} land-ready ${taking.map((one) => one.key).join(" ")}`);
};

/** The keys an empty call takes, said before anything is spent; `startsAtPin` is the take's own reading. */
export const readyKeys = async (ctx, startsAtPin) => {
  const read = await asked(() => everyIssue({}));
  const short = shortOf(read, "The set of issues a landing could take");
  if (short) stop(SHORT(short, ctx.self));
  const found = await foundIn(read.rows.filter((row) => BAND.includes(String(row.status ?? ""))));
  const taking = found.filter((one) => startsAtPin(one.landing));
  shown(found, taking, ctx.self);
  if (!taking.length) stop(NOTHING(ctx.self, found.length));
  return taking.map((one) => one.key);
};

/* The batch a named key brings with it. A batch tree is one branch and one head for every key its run
   id names, and each member's worklog says so, so naming one member and landing it alone leaves the
   rest at `ready` for a change the base already carries (ISS-2656). A sibling is taken only where its
   own record agrees: the same batch on its worklog, the same branch and head on its checkpoint, and a
   state the landing starts at the pin from. Anything else is named with why, and nothing of it moves. */
const upper = (key) => String(key ?? "").toUpperCase();

const at = (landing) => `${landing.branch || "no branch"} at ${shortly(landing.head) || "no head"}`;

/* Why a sibling is not this landing's, or null where it is. */
const whyNot = (own, theirs, startsAtPin) => {
  if (theirs.unread) return `its record could not be read (${theirs.unread})`;
  const agrees = batchAgrees(worklogOf(own.context)?.batch, worklogOf(theirs.context)?.batch);
  if (agrees === "none") return "its own worklog names no batch";
  if (agrees === "other") return `its own worklog names another batch, ${worklogOf(theirs.context).batch}`;
  const mine = landingOf(own.context);
  const landing = landingOf(theirs.context);
  if (!landing) return "it carries no landing checkpoint";
  if (landing.branch !== mine.branch || landing.head !== mine.head) {
    return `its checkpoint names ${at(landing)}, and this landing takes ${at(mine)}`;
  }
  if (!startsAtPin(landing)) return `its checkpoint reads \`${landing.state}\`, which is not a turn this landing starts at the pin`;
  return null;
};

const readSoftly = async (read, key) => {
  try {
    return await read(key);
  } catch (error) {
    return { unread: String(error?.message ?? error).replace(/\s+/gu, " ").trim() };
  }
};

const leftOut = (sibling, key, why) =>
  console.log(`  ${sibling}, on ${key}'s batch, is left out: ${why}. Nothing of it moves:\n    forge resume ${sibling}`);

/** `keys` with each named key's batch siblings after it, where each sibling's own record agrees. A
 *  sibling one named key leaves is read again under the next, whose batch it may be. 
 *  `read` is the landing's read of one record; `alone` is a route that takes one change per candidate,
 *  where no sibling is added and each is named instead. */
export const withSiblings = async (keys, { read, startsAtPin, alone }) => {
  const out = [];
  const taken = new Set(keys.map(upper));
  for (const key of keys) {
    out.push(key);
    const own = await readSoftly(read, key);
    if (own.unread || !landingOf(own.context)) continue;
    const siblings = membersOf(worklogOf(own.context)?.batch).map(upper).filter((one) => !taken.has(one));
    for (const sibling of siblings) {
      if (alone) {
        leftOut(sibling, key, alone);
        continue;
      }
      const why = whyNot(own, await readSoftly(read, sibling), startsAtPin);
      if (why) {
        leftOut(sibling, key, why);
        continue;
      }
      console.log(`  ${sibling}, on ${key}'s batch at the same branch and head, is taken with it`);
      taken.add(sibling);
      out.push(sibling);
    }
  }
  return out;
};
