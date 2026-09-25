/* The tracker's half of `forge spec proofs`: what became of each issue an escape names, read off the
   whole-project issue list `forge doctor` judges the same escapes against, so both say one thing. */
import { everyIssue } from "../tracker/issues.mjs";
import { ended, statusesFrom } from "../checks/docs/owing-escapes.mjs";

/** `{ statusOf, owes, why }`. Soft, and a walk that threw is a short reading rather than an exit: the
 *  verb is a reading, and a list it could not read is one it says went unread. */
export const readOwing = async () => {
  const read = await everyIssue({}, { soft: true })
    .catch((error) => ({ rows: [], whole: false, refused: error.message }));
  const { statusOf, why } = statusesFrom(read);
  return { statusOf, why, owes: (status) => !ended(status) };
};
