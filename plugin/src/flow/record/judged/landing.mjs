/* Where a change landed when it landed in no repository: a live store write, a CMS entry, a page. The
   tracker decides per project which of the two shapes an issue lands in and answers it on every issue
   as `landingShape`, and a landed mark there carries `mergedLanding`, the place a reader goes to check.
   Both are read off the tracker's own fields here and nowhere else, so no reader guesses the shape from
   the project's other keys or parses the place back out of a comment's prose (ISS-2402). */
import { typedBack } from "../../../refusal.mjs";
import { isCommit } from "../../../tracker/evidence.mjs";
import { lengthOf } from "../../../tracker/field-write.mjs";

const OUTSIDE_GIT = "outside_git";

/** Absent is git, which is what every issue was before the tracker had the field — unless the row
 *  carries a landing: a listed row omits the shape and keeps `mergedLanding`, and the tracker refuses
 *  a landing on any mark of an issue landing in git (`LANDING_NOT_THIS_SHAPE`). */
export const landsOutsideGit = (issue) => ((issue?.landingShape ?? null) === null
  ? Boolean(String(issue?.mergedLanding ?? "").trim())
  : issue.landingShape === OUTSIDE_GIT);

/** The place the standing mark names, or null where none stands or the issue lands in git. */
export const markedLanding = (issue) => {
  if (!landsOutsideGit(issue) || !issue?.mergedAt) return null;
  const held = String(issue?.mergedLanding ?? "").trim();
  return held || null;
};

/** One place, however it was padded: a landing is compared as the words that name it. */
export const samePlace = (one, two) =>
  typeof one === "string" && typeof two === "string" && one.trim() === two.trim() && one.trim() !== "";

/* The tracker's own bound on `landing`, 1..2000 characters. */
const ROOM = 2000;

/** What a landing may not be, or null where it stands. A value a reader and every tool would take for a
 *  sha is refused, since following it opens a commit that holds nothing of the change; a value on
 *  several lines is refused, since a record field is read back one line at a time. */
export const landingProblem = (value) => {
  const held = String(value ?? "").trim();
  if (!held) return "takes where the change now is — a URL, a CMS entry, a store resource — and was given nothing";
  if (/[\r\n]/u.test(held)) return `takes one line, and \`${held.split(/\r?\n/u)[0]}…\` runs over several`;
  if (lengthOf(held) > ROOM) return `takes at most ${ROOM} code points, the tracker's own bound, and was given ${lengthOf(held)}`;
  if (isCommit(held)) {
    return `takes where the change now is, and \`${held}\` reads as a commit sha: every reader would open `
      + "it as the commit the change landed at, which is what an issue landing outside git has none of";
  }
  return null;
};

/** The identity a record names what it judged by, as the flag a command carries: the mark's value
 *  where one stands. `markedIdentity` in record/merged.mjs is what reads it off an issue. */
export const identityAsk = ({ flag, value }, placeholder = "<sha>") => (flag === "landing"
  ? `--landing ${value ? typedBack(value) : "'<where the change now is>'"}`
  : `--commit ${value ?? placeholder}`);
