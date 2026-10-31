/* Which merged mark stands, and what it says. The commit is core's: its issue record carries the
   commit the current mark names (`markedCommit`, observed or as the marker stated it) and the head a
   host merge landed (`mergedHead`), and a merge core's own route stamped writes no note this plugin
   composed. The thread's note is read for its clauses only where it names that same commit; a newer
   stamp makes it the note of an earlier landing (adminhub-api ISS-78). Where core's record carries no
   such field the thread's note answers, and `markReadLines` says so. docs/cli/record-merged.md. */
import { unwrap } from "../../machine.mjs";
import { sameCommit } from "../../../tracker/evidence.mjs";
import { landsOutsideGit, markedLanding } from "./landing.mjs";
import { CLAUSES } from "./merged-clauses.mjs";

/* The audit comment for the mark opens on the action's name, which is what tells a mark from a comment quoting one. */
const MARK = /^mark_merged\b/u;

/** A path clause saying no path at all. */
export const NONE = /^nothing(?: of this change| this change touched)?\.?$/iu;

const clause = (flag) => CLAUSES.find((one) => one.flag === flag);

const markOf = (comments) => {
  const marks = (comments ?? []).map((one) => unwrap(one.body)).filter((body) => MARK.test(body));
  return marks.length ? marks.at(-1) : null;
};

/* One walk per page, whichever clause asks: `verdictHeads` alone asks four times for each issue
   `forge spec --status` reads. A page is a fresh array per read and nothing writes into one after,
   but a page that has grown since is walked again rather than trusted. */
const walked = new WeakMap();

/** The note of the mark on the thread: the latest, a re-mark after a second landing being the one
 *  that landed. */
export const lastMark = (comments) => {
  if (!Array.isArray(comments)) return markOf(comments);
  const held = walked.get(comments);
  if (held && held.length === comments.length && held.last === comments.at(-1)) return held.mark;
  const mark = markOf(comments);
  walked.set(comments, { length: comments.length, last: comments.at(-1), mark });
  return mark;
};

const readClause = (comments, flag) => clause(flag).reads.exec(lastMark(comments) ?? "")?.[1] ?? null;

/** The paths a path clause names: none for the word, null where it names nothing readable. */
export const pathsIn = (said) => {
  if (!said) return null;
  if (NONE.test(said)) return [];
  const paths = said.split(",").map((one) => one.trim()).filter(Boolean);
  return paths.length ? paths : null;
};

const threadMark = (comments) => ({
  at: readClause(comments, "at"),
  reviewed: readClause(comments, "reviewed"),
  judged: readClause(comments, "judged"),
  moved: pathsIn(readClause(comments, "moved")?.trim()),
  wrote: pathsIn(readClause(comments, "wrote")?.trim()),
});

/* A mark core stamped with no note of ours: the head it landed, and whether its tree is the landing's,
   which is core's own reading of a verdict at that head counting for the landing. */
const coreMark = (at, head) => {
  const same = head?.treeIdentical === true;
  return { at, reviewed: head?.sha ?? null, judged: same ? head.sha : null, moved: same ? [] : null, wrote: null };
};

const NO_MARK = { at: null, reviewed: null, judged: null, moved: null, wrote: null };

/** The mark that stands on `{ issue, comments }`: `from` says whose word it is, and `why` why it is
 *  the thread's where core's record could not answer. */
const standingMark = ({ issue, comments }) => {
  const thread = threadMark(comments);
  if (!issue || !("markedCommit" in issue)) {
    return { ...thread, from: "thread", why: "core's issue record carries no markedCommit" };
  }
  const core = issue.markedCommit?.sha ?? issue.mergedCommitSha ?? null;
  if (!core && issue.mergedAt) return { ...thread, from: "thread", why: "core's mark names no commit" };
  if (!core) return { ...NO_MARK, from: "core" };
  if (thread.at && sameCommit(thread.at, core)) return { ...thread, at: core, from: "core" };
  return { ...coreMark(core, issue.mergedHead), from: "core" };
};

export const markedCommit = (held) => standingMark(held).at;
export const reviewedHead = (held) => standingMark(held).reviewed;
export const judgedHead = (held) => standingMark(held).judged;
export const landingMoved = (held) => standingMark(held).moved;
export const landingWrote = (held) => standingMark(held).wrote;

/** What a record of this issue names what it judged by: the landing its mark names where the tracker
 *  says the issue lands outside git, and the commit the mark names everywhere else. One answer for the
 *  fill, the entry checks and the commands they print, so none of them asks one shape for the other's
 *  flag (ISS-2402). */
export const markedIdentity = (held) => (landsOutsideGit(held.issue)
  ? { flag: "landing", value: markedLanding(held.issue) }
  : { flag: "commit", value: markedCommit(held) });

/** ISS-156's rule, spent by two readers: a landing that moved none of this change's paths judged the code that landed, so a verdict at the judged head stands and the commits below are what one may cite. */
export const judgedStands = (held) => Boolean(judgedHead(held)) && landingMoved(held)?.length === 0;

export const verdictHeads = (held) => [
  markedCommit(held),
  ...(judgedStands(held) ? [judgedHead(held)] : []),
].filter(Boolean);

/** Said under the owed list where the mark it reads is the thread's word alone. */
export const markReadLines = (view) => {
  const mark = standingMark(view);
  return mark.from === "thread" && mark.at
    ? [`  The merged mark is read off the thread's note (${mark.at}), since ${mark.why}: a mark core's merge route stamped is not in it.`]
    : [];
};
