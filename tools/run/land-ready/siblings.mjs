/* The batch a named key brings with it. A batch tree is one branch and one head for every key its run
   id names, and each member's worklog says so, so naming one member and landing it alone leaves the
   rest at `ready` for a change the base already carries (ISS-2656). A sibling is taken only where its
   own record agrees: the same batch on its worklog, the same branch and head on its checkpoint, and a
   state the landing starts at the pin from. Anything else is named with why, and nothing of it moves. */
import { landingOf } from "../../../plugin/src/flow/landing/checkpoint.mjs";
import { batchAgrees, membersOf } from "../../../plugin/src/flow/lease/batch.mjs";
import { worklogOf } from "../../../plugin/src/flow/worklog.mjs";
import { shortly } from "../install.mjs";

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

/** `keys` with each named key's batch siblings after it, where each sibling's own record agrees.
 *  `read` is the landing's read of one record; `alone` is a route that takes one change per candidate,
 *  where no sibling is added and each is named instead. */
export const withSiblings = async (keys, { read, startsAtPin, alone }) => {
  const out = [];
  const seen = new Set(keys.map(upper));
  for (const key of keys) {
    out.push(key);
    const own = await readSoftly(read, key);
    if (own.unread || !landingOf(own.context)) continue;
    const siblings = membersOf(worklogOf(own.context)?.batch).map(upper).filter((one) => !seen.has(one));
    for (const sibling of siblings) {
      seen.add(sibling);
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
      out.push(sibling);
    }
  }
  return out;
};
