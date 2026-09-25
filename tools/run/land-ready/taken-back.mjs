/* A member whose clean merge still carries a revert of work that landed under its branch (ISS-369).
   What answers it is a new head of that branch, so it goes back at `head-owed` as a conflict does,
   and the set goes on without it. What counts as taken back: ../undone.mjs. */
import { gitOut, stop } from "../../checkout.mjs";
import { shortly } from "../install.mjs";
import { undoneBy, undoneLine, undoneSaid } from "../undone.mjs";
import { saveOn } from "./member.mjs";
import { LANDING_HEAD_OWED, RECAPTURE, landingNext } from "../../../plugin/src/flow/landing/checkpoint.mjs";

export const takenBack = async (member, pin, root) => {
  const { key, landing } = member;
  console.log(`  ${landing.branch} merges clean onto ${shortly(pin)}`);
  const was = gitOut(["merge-base", landing.head, pin], root);
  const found = was
    ? undoneBy(root, { was, head: landing.head, branch: landing.branch })
    : { judged: false, why: `${shortly(landing.head)} and ${shortly(pin)} share no history` };
  if (!found.undone?.length) return console.log(`  ${undoneLine(found)}`);
  const back = landingNext(landing, LANDING_HEAD_OWED) === null;
  if (back) await saveOn(member, { state: LANDING_HEAD_OWED });
  return stop(`${landing.branch}: ${undoneSaid(found, was, landing.head)}\n${back
    ? `The checkpoint is at \`${LANDING_HEAD_OWED}\`, and the run that built the branch pushes the head `
      + `that answers it, then captures that head:\n${RECAPTURE(key)}`
    : `The checkpoint reads \`${landing.state}\`, past the states a branch is handed back from. Read `
      + `where it is:\n  forge resume ${key}`}`);
};
