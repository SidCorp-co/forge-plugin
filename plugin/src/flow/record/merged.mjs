/* The merged mark, written and read in one place: the five clauses its note is built from, the
   reading each earns, and the one route that hangs a mark or takes it down. Together because the
   note is prose on the wire, and a second spelling of a clause puts a sha in the slot the next
   status reads for another one. docs/cli/record-merged.md. */
import { spawnSync } from "node:child_process";

import { refuse } from "../../refusal.mjs";
import { typed } from "../../hooks/shell-spans.mjs";
import { flags } from "../../resolve/flags.mjs";
import { shipMode } from "../../resolve/settings.mjs";
import { commentPage, creditAfter } from "../../tracker/comments.mjs";
import { isCommit, sameCommit, shortSha } from "../../tracker/evidence.mjs";
import { capsOf, lengthOf } from "../../tracker/field-write.mjs";
import { releasePolicy } from "../../tracker/project-config.mjs";
import { escaped } from "../../markdown.mjs";
import { scoped, write } from "../../tracker/rest.mjs";
import { notAnothers, renew } from "../lease.mjs";
import { unwrap } from "../machine.mjs";
import { commitProblem, commitTakes } from "./content.mjs";
import { landingProblem, landsOutsideGit, markedLanding } from "./judged/landing.mjs";
import { commitCarries } from "../../git/carries.mjs";
import { movedBetween, unreadableIn } from "../../git/moved.mjs";

/* The audit comment for the mark opens on the action's name, which is what tells a mark from a comment quoting one. */
const MARK = /^mark_merged\b/u;

/** The word a clause carrying no path takes. Enumerated on the read, because `nothingness` and
 *  `nothing generated` are paths and a clause that parses to no path says nothing rather than none. */
export const NOTHING = "nothing";
const NONE = /^nothing(?: of this change| this change touched)?\.?$/iu;

const shaOf = (said) => new RegExp(String.raw`\b${said} ([0-9a-f]{7,40})\b`, "iu");
const clauseOf = (said) => new RegExp(String.raw`\b${said} ([^;\n]+)`, "iu");

/* One row per clause: the flag that writes it, the words it is written and read by, and what it
   holds. The order is the note's order, so the sentence is this table joined. */
export const CLAUSES = [
  { flag: "at", said: "at", label: "the sha the change landed at", commit: true },
  { flag: "reviewed", said: "reviewed head", label: "the head the review judged", commit: true },
  { flag: "judged", said: "judged head", label: "the head the verdicts judged", commit: true,
    none: "no verdict has judged any head yet" },
  { flag: "moved", said: "landing moved", label: "the paths of this change the landing moved, as git reads --wrote between --judged and --at", read: true },
  { flag: "wrote", said: "landing wrote", label: "the paths this change itself landed" },
].map((one) => ({ ...one, reads: one.commit ? shaOf(one.said) : clauseOf(one.said),
  ...(one.none ? { readsNone: new RegExp(String.raw`\b${one.said} ${NOTHING}\b`, "iu") } : {}) }));

const clause = (flag) => CLAUSES.find((one) => one.flag === flag);

/* A head clause that may say none, under a builder whose project leaves the verdicts to another run
   (ISS-1960): the word the path clauses take, followed by what it means in words, so the note says
   no head was judged rather than leaving the clause out. Its sha reader finds nothing there, so
   every reader of the head reads it as none. */
const headSaid = (one, value) => (value === NOTHING ? `${NOTHING} — ${one.none}` : value);

const markOf = (comments) => {
  const marks = (comments ?? []).map((one) => unwrap(one.body)).filter((body) => MARK.test(body));
  return marks.length ? marks.at(-1) : null;
};

/* One walk per page, whichever clause asks: `verdictHeads` alone asks four times for each issue
   `forge spec --status` reads. A page is a fresh array per read and nothing writes into one after,
   but a page that has grown since is walked again rather than trusted. */
const walked = new WeakMap();

/** The note of the mark that stands: the latest, a re-mark after a second landing being the one
 *  that landed. */
export const lastMark = (comments) => {
  if (!Array.isArray(comments)) return markOf(comments);
  const held = walked.get(comments);
  if (held && held.length === comments.length && held.last === comments.at(-1)) return held.mark;
  const mark = markOf(comments);
  walked.set(comments, { length: comments.length, last: comments.at(-1), mark });
  return mark;
};

/* What the standing mark says in one clause, or null where it says nothing there. */
const readClause = (comments, flag) => clause(flag).reads.exec(lastMark(comments) ?? "")?.[1] ?? null;

export const markedCommit = (comments) => readClause(comments, "at");

/** What a record of this issue names what it judged by: the landing its mark names where the tracker
 *  says the issue lands outside git, and the commit its note names everywhere else. One answer for the
 *  fill, the entry checks and the commands they print, so none of them asks one shape for the other's
 *  flag (ISS-2402). */
export const markedIdentity = (issue, comments) => (landsOutsideGit(issue)
  ? { flag: "landing", value: markedLanding(issue) }
  : { flag: "commit", value: markedCommit(comments) });

export const reviewedHead = (comments) => readClause(comments, "reviewed");
export const judgedHead = (comments) => readClause(comments, "judged");

const pathsIn = (said) => {
  if (!said) return null;
  if (NONE.test(said)) return [];
  const paths = said.split(",").map((one) => one.trim()).filter(Boolean);
  return paths.length ? paths : null;
};

const readPaths = (comments, flag) => pathsIn(readClause(comments, flag)?.trim());

export const landingMoved = (comments) => readPaths(comments, "moved");

/** ISS-156's rule, spent by two readers: a landing that moved none of this change's paths judged the code that landed, so a verdict at the judged head stands and the commits below are what one may cite. */
export const judgedStands = (comments) =>
  Boolean(judgedHead(comments)) && landingMoved(comments)?.length === 0;

export const verdictHeads = (comments) => [
  markedCommit(comments),
  ...(judgedStands(comments) ? [judgedHead(comments)] : []),
].filter(Boolean);
export const landingWrote = (comments) => readPaths(comments, "wrote");

/* What the clauses are joined by, so a path holding one reads as its clause ending there and a `moved` with one path in it reads as none moved, which is the reading a status acts on. Refused wherever the note is composed, the landing task composing one too, and under its own flag where one was typed; and what no path may hold, said once for the flag that names itself and for the composer that has no flag to name. */
const APART = /[;\n]/u;

const pathHeld = (paths) => {
  const barred = paths.find((one) => APART.test(one) || one.includes(","));
  if (barred) {
    return `\`${barred}\` cannot travel in the mark's note: the note's clauses are separated by \`;\` `
      + "and the paths in one by `,`, so a reader would take part of this path for another clause or "
      + "another path. Name the directory it is under, or the path without the separator.";
  }
  const none = paths.find((one) => NONE.test(one));
  if (none) {
    return `\`${none}\` is the word this clause takes for no paths at all, so a path of that name `
      + "cannot travel in the note: alone it would read back as a landing that moved none of them, "
      + "which is what lets the verdicts stand, and beside another path it says both and so neither. "
      + "Name it some other way — the directory it is under, or the path with its extension.";
  }
  return null;
};

const pathsSaid = (paths) => {
  const held = paths ?? [];
  const wrong = pathHeld(held);
  if (wrong) refuse(wrong);
  return held.length ? held.join(", ") : NOTHING;
};

/* And what a typed one may not: whitespace, which is what tells a phrase in a clause from a filename. Barred on the flag route alone, the composer being handed `git diff` paths that may hold a space and owing the read-back below instead.
   Why the shape and not the filesystem, and why the ship prints the flag rather than the clause: docs/cli/record-merged-the-paths.md. */
const SPACED = /\s/u;

const opensWith = (given) => CLAUSES.find((one) =>
  !one.commit && new RegExp(String.raw`^${one.said}\b`, "iu").test(given.trim()));

const typedProblem = (one, paths, given) => {
  const held = pathHeld(paths);
  if (held) return held;
  const spaced = paths.find((path) => SPACED.test(path));
  if (!spaced) return null;
  const said = opensWith(given);
  return `takes ${one.label}, separated by commas, or the word \`${NOTHING}\`; \`${spaced}\` holds `
    + "whitespace, which nothing that reads the note back can tell from a phrase, so a status would "
    + "report it as a file this change touched. "
    + (said
      ? `\`${said.said}\` is the note's own wording rather than part of the value — what the flag `
        + `takes is what follows it, which here is \`${given.trim().slice(said.said.length).trim()}\`.`
      : "Name a path that really holds a space by the directory it is under.");
};

/* A whole path or nothing, prefixes included; a trailing dot ends a sentence unless a name follows. Beside the note rather than beside the check that spends it, because the composer asks the same question of the same text before it leaves a path out. */
export const namesPath = (named, path) =>
  new RegExp(`(?<![\\w./-])${escaped(path)}(?![\\w/-])(?!\\.\\w)`, "u").test(named);

/** The write that names a path the plan does not, spelt once: the mark's own refusal and `developed`'s shortfall both spend it, and two spellings would send a run to two commands. */
export const correctionForm = (ref, paths) =>
  `forge record correction ${ref} --corrects plan --moved "the change also wrote ${paths.join(", ")}" `
  + `--why "<why each was needed>"`;

/** The view `developed` reads each path of the note against — the plan and its corrections — for the composer that must not leave out what that check would refuse, with the reader of that text beside it. The import is at the call because `earned.mjs` reads this module's clauses, so a static one back would be a cycle, and it is made once per write. */
const viewOn = async (documentId, comments) => {
  const { viewFrom, namedIn } = await import("../earned.mjs");
  const issue = await scoped("forge_issues", { action: "get", documentId, fields: [] });
  const page = comments ?? (await commentPage(documentId)).comments ?? [];
  return { view: viewFrom(documentId, issue ?? {}, page ?? []), namedIn };
};

export const namedFor = async (documentId, comments = null) => {
  const { view, namedIn } = await viewOn(documentId, comments);
  return namedIn(view);
};

/* `nothing` is true only where no verdict stands on the page: a run holding verdicts has the head
   they judged, and the word would drop it and say none were taken. Refused naming every head those
   verdicts judged, so the run re-sends with the one it means. */
const judgedTruly = (view, judged, again) => {
  if (judged !== NOTHING) return;
  const held = [...view.verdicts.values(), ...(view.unreadable ?? [])];
  const heads = [...new Set(held.map(({ record }) => record.fields?.commit).filter(Boolean))];
  if (!heads.length) return;
  refuse(`--judged ${NOTHING} says ${clause("judged").none}, and this page carries verdicts judged at `
    + `${heads.join(", ")}, so nothing was written. Name the head they judged:\n  ${again(heads[0])}`);
};

const sentenceOf = ({ branch, at, reviewed, judged, moved, wrote, tail = "" }) =>
  `merged to ${branch} ${clause("at").said} ${at}; ${clause("reviewed").said} ${reviewed}; `
  + `${clause("judged").said} ${headSaid(clause("judged"), judged)}; ${clause("moved").said} ${pathsSaid(moved)}; `
  + `${clause("wrote").said} ${pathsSaid(wrote)}${tail}`;

/* The room the note has, off the route table like every other field's cap: a composer fitting to a number of its own would be deciding the tracker's limit for it. */
const roomOf = () => capsOf().note?.self ?? null;

/* What stands in for the paths there was no room for, after the `;` that ends the path clause, which is read only as far as that separator — so no word of this is taken for a path or for another clause. Only paths the plan names are ever left out, which is what makes a count enough. */
const leftOut = (kept, whole, named) =>
  `; that clause holds ${kept} of this change's ${whole} paths and leaves out ${whole - kept} `
  + `${named ? "the plan names" : "that no plan of this issue names"}, whose whole list is the diff `
  + `of the judged head above against its base`;

const tooLong = (over, room, owed, ref) => (owed.length
  ? `the note is ${over} code points over the ${room} the tracker takes with only the ${owed.length} `
    + `path(s) the plan and its corrections do not name in it, and those are the paths \`developed\` `
    + `reads, so none of them may be left out: nothing was written. Name them in the correction that `
    + `status asks for and mark again — they are named then, and the note has the room to leave them `
    + `out:\n  ${correctionForm(ref, owed)}`
  : `the note is ${over} code points over the ${room} the tracker takes with the shortest written `
    + `path in it and no other, so what overran is the \`landing moved\` clause: nothing was written. That `
    + `clause is never shortened, a landing that moved this change's paths being what stands the `
    + `verdicts down. Name the directory those paths are under.`);

/* Every path the plan does not name stays in the clause and the ones it names fill what room is left, so `developed` reads the set it would have read off the whole list: what is left out is what that check already passes. A change whose unnamed paths alone overrun the note is refused rather than quietly shortened, because shortening there would earn the status a change that grew has not. No plan at all is a change `developed` reads no path of against anything, so the rung that writes none is excused the check and this refusal both. The floor is measured on the shortest path and a path the room cannot take is passed over rather than ending the fill, because a long one first would blame `landing moved` for a note a shorter path fits in. */
const fitted = (held, named, ref) => {
  const room = roomOf();
  const whole = sentenceOf(held);
  if (room === null || lengthOf(whole) <= room) return { note: whole, wrote: held.wrote };
  const text = named.trim();
  const noteOf = (kept) =>
    sentenceOf({ ...held, wrote: kept, tail: leftOut(kept.length, held.wrote.length, text) });
  const owed = text ? held.wrote.filter((one) => !namesPath(text, one)) : [];
  const over = (kept) => lengthOf(noteOf(kept)) - room;
  const least = held.wrote.length ? [[...held.wrote].sort((one, two) => lengthOf(one) - lengthOf(two))[0]] : [];
  if (over(least) > 0) refuse(tooLong(over(least), room, [], ref));
  const keep = owed.length ? [...owed] : least;
  if (over(keep) > 0) refuse(tooLong(over(keep), room, owed, ref));
  for (const one of held.wrote) {
    if (keep.includes(one) || over([...keep, one]) > 0) continue;
    keep.push(one);
  }
  return { note: noteOf(keep), wrote: keep };
};

const backSaid = (held) => {
  if (held === null) return "nothing at all";
  return Array.isArray(held) ? (held.length ? held.join(", ") : `\`${NOTHING}\``) : String(held);
};

const readsBack = (note, one) => (one.commit
  ? one.reads.exec(note)?.[1] ?? (one.none && one.readsNone.test(note) ? NOTHING : null)
  : pathsIn(one.reads.exec(note)?.[1]?.trim()));

const asGiven = (back, wanted) => (Array.isArray(wanted)
  ? Array.isArray(back) && back.length === wanted.length && back.every((held, at) => held === wanted[at])
  : String(back).toLowerCase() === String(wanted).toLowerCase());

/* Every clause is found by its own words wherever they fall in the note, so a path carrying another clause's words is read as
   that clause and the mark says a landing moved or wrote what it did not. The composer reads its own sentence back rather than
   barring a list of substrings, which the next clause added to the table above would silently leave short. */
const proved = (note, given) => {
  for (const one of CLAUSES) {
    const back = readsBack(note, one);
    if (asGiven(back, given[one.flag])) continue;
    refuse(`the note this mark would carry does not read back, so nothing was written: its `
      + `\`${one.said}\` clause reads as ${backSaid(back)} where ${backSaid(given[one.flag])} was `
      + `given. A clause is found by its own words wherever they fall in the note, and one of these `
      + `values carries another clause's words: ${CLAUSES.map((row) => `\`${row.said}\``).join(", ")}. `
      + `Name the paths some other way — the directory one is under, or a path without those words.`);
  }
  return note;
};

/** The note itself, from the same rows the readers above are built on: whoever lands a change —
 *  the verb below, or the landing task — composes it here and nowhere else, built to the room the
 *  tracker gives it, and it reads back as written or it is not written. `named` is what the paths
 *  are ranked by; without it every path is one the note may not leave out. */
export const markNote = ({ branch, at, reviewed, judged, moved = [], wrote = [], named = "",
  ref = "<uuid|ISS-45>" }) => {
  const fit = fitted({ branch, at, reviewed, judged, moved, wrote }, named, ref);
  return proved(fit.note, { at, reviewed, judged, moved, wrote: fit.wrote });
};

const TARGET = "base";

export const undoForm = (ref) => `forge record merged ${ref} --undo`;

const rowOf = (documentId) => scoped("forge_issues", { action: "get", documentId, fields: [] });

/* The tracker keeps the first stamp a row carries and answers a second mark `already_merged`, while the audit comment it writes still carries the new note — which every reader here takes as the mark that stands. So a mark over a stamp naming no commit or another one would leave the note naming one commit and the row another (ISS-1808), and is refused before it is sent. */
const stampStands = (row, ref, commit) => {
  if (!row?.mergedAt || sameCommit(row.mergedCommitSha, commit)) return;
  refuse(`${ref} already carries a merged stamp from ${row.mergedAt}, `
    + `${row.mergedCommitSha ? `at ${row.mergedCommitSha}` : "naming no commit"}, and the tracker keeps the `
    + `first stamp, so a mark at ${commit} would post a note the row contradicts: nothing was written. `
    + `Take the standing stamp down, then mark again:\n  ${undoForm(ref)}`);
};

/** What the row's commit field holds once a mark at `commit` stands, refused where it names another commit. The column is the tracker's and takes only a commit it observed, so empty is an answer and not a disagreement. Spent after a write and by the landing task before it counts a mark already up as done. */
export const stampHolds = async (documentId, ref, commit) => {
  const held = (await rowOf(documentId))?.mergedCommitSha ?? null;
  if (!held || sameCommit(held, commit)) return held;
  return refuse(`${ref}'s mark names ${commit} and the row's commit field holds ${held}, the commit the `
    + `tracker observed landing, so the note and the row name different commits. Take the mark down, `
    + `and mark again at the commit that landed:\n  ${undoForm(ref)}`);
};

/* `already_merged` is the tracker keeping the stamp it held; that is agreement only where the stamp it kept names this same commit. */
const answerKept = async (answer, documentId, ref, commit) => {
  if (answer?.action !== "already_merged") return;
  if (sameCommit((await rowOf(documentId))?.mergedCommitSha, commit)) return;
  refuse(`the tracker answered \`already_merged\` for ${ref}: it kept the stamp it held, while the mark `
    + `just posted names ${commit}, so the note and the row disagree. Take the mark down and write it `
    + `again:\n  ${undoForm(ref)}`);
};

/** The mark, and the audit comment it causes credited in the same breath: the next write to the issue is refused for a comment nothing has read, and every route that causes one clears it. The lease is checked here rather than only at the call site because the landing task marks a merge too, holding a lease this must not renew — a renewal would rewrite the landing state saved a step before it — so a check no caller can reach the write without is a read and not a renewal. `leased` is the caller that renewed a moment ago, whose renewal was that read. A git mark carries its `commit` as the tracker's own field, and answers with what the row's field then holds. */
export const markMerged = async (documentId, ref, note, { leased = false, landing, commit } = {}) => {
  if (!leased) await notAnothers(documentId, ref);
  if (commit) stampStands(await rowOf(documentId), ref, commit);
  const answer = await write("forge_issues", { action: "mark_merged", data: { issueId: documentId,
    target: TARGET, note, ...(commit ? { commit } : {}), ...(landing ? { landing } : {}) } });
  await creditAfter("the merged mark", [{ ref, documentId }]);
  if (!commit) return { answer, held: null };
  await answerKept(answer, documentId, ref, commit);
  return { answer, held: await stampHolds(documentId, ref, commit) };
};

/* `soft` is the caller that has something to say about a refusal the transport would otherwise print
   bare and exit on: the repair after a close has a status already moved and a correction already up, so
   a reader told only what the tracker said is left holding a stamp with no word of what still stands or
   what removes it (ISS-2125). It answers with the refusal rather than raising it, and credits nothing,
   there being no audit comment behind a write that did not land. */
export const unmarkMerged = async (documentId, ref, { soft = false } = {}) => {
  await notAnothers(documentId, ref);
  const answer = await write("forge_issues", { action: "unmark", data: { issueId: documentId } },
    undefined, soft);
  if (answer?.refused) return answer;
  await creditAfter("the unmark", [{ ref, documentId }]);
  return answer;
};

const flagSaid = (one) => `--${one.flag} <${one.label}>`;

/* The clauses a caller types. `landing moved` is not among them: the verb reads it from git, so a form
   carrying the flag would hand a run a value to guess at and a refusal to learn it from (ISS-2485). */
const TYPED = CLAUSES.filter((one) => !one.read);

/* The flag an issue landing outside git is marked by, and the words a reader is told it takes. */
const LANDING_SAID = "where the change now is: a URL, a CMS entry, a store resource";
const landingForm = (ref) => `forge record merged ${ref} --landing '<${LANDING_SAID}>'`;

/** The mark an issue is asked for, in the shape the tracker says it lands in: `issue` absent is git. */
export const mergedForm = (ref, issue = null) => (landsOutsideGit(issue)
  ? landingForm(ref)
  : `forge record merged ${ref} ${TYPED.map(flagSaid).join(" ")}`);

const valueOf = (one, given) => {
  if (one.commit) {
    if (one.none && String(given).trim().toLowerCase() === NOTHING) return NOTHING;
    if (!isCommit(given)) {
      refuse(`--${one.flag} ${one.none
        ? `takes ${commitTakes(one)}, or the word \`${NOTHING}\` where ${one.none}, not \`${given}\`.`
        : commitProblem(one, given)}`);
    }
    return given;
  }
  const paths = pathsIn(given);
  if (paths === null) {
    refuse(`--${one.flag} takes ${one.label}, separated by commas, or the word \`${NOTHING}\`; `
      + `\`${given}\` parses to no path at all.`);
  }
  const wrong = typedProblem(one, paths, given);
  if (wrong) refuse(`--${one.flag} ${wrong}`);
  return paths;
};

/* Every missing clause at once. The shape's own loop refuses on the first, which costs a round per
   flag, and the mark is the one payload whose flags a run types five of (ISS-680). */
const clausesFrom = (given) => {
  const absent = TYPED.filter((one) => given[one.flag] === undefined);
  if (absent.length) {
    refuse(`record merged needs ${absent.map((one) => `--${one.flag}`).join(", ")}, `
      + `${absent.length === 1 ? "which is a clause" : "which are clauses"} of the mark's note and `
      + `${absent.length === 1 ? "has" : "have"} no default:\n  ${mergedForm("<uuid|ISS-45>")}`);
  }
  return Object.fromEntries(CLAUSES.filter((one) => given[one.flag] !== undefined)
    .map((one) => [one.flag, valueOf(one, given[one.flag])]));
};

/* A typed entry may be a directory, which is the route this verb gives for a path the note cannot
   carry: the typing agrees with git where every path git read is under an entry and every entry holds
   a path git read. */
const under = (entry, path) => path === entry || path.startsWith(`${entry.replace(/\/+$/u, "")}/`);
const sameReading = (read, moved) =>
  read.every((path) => moved.some((entry) => under(entry, path)))
  && moved.every((entry) => read.some((path) => under(entry, path)));

/* Where the landing's reading starts: the judged head, or the reviewed one where no verdict has judged
   a head, which is the head the change stood at before the landing. No reader takes the clause
   without a judged head, so there it says what the landing moved and stands no verdict up or down. */
const movedFrom = ({ judged, reviewed }) => (judged === NOTHING
  ? { sha: reviewed, flag: "--reviewed", said: clause("reviewed").said }
  : { sha: judged, flag: "--judged", said: clause("judged").said });

/* The clause that stands the verdicts down or lets them stand is git's reading and never the run's:
   a run listing every path a no-op merge touched re-owed twenty-six verdicts about identical bytes,
   and a run saying `nothing` over a merge that moved its file would have kept them (ISS-1362). So the
   clause is read here whether or not it was typed, and a typed one is compared rather than dropped:
   a flag given and ignored reads to its caller exactly like the value it asked for being written
   (ISS-2485). What is read is the change's own paths and not the whole tree: a neighbour the landing
   moved is the review's and the reconcile's to read at the landed head, never a verdict's. The
   directory a typed entry may name is kept in the note, since the value written is the value given. */
const movedRead = (clauses, tree, again) => {
  const { at, moved, wrote } = clauses;
  const from = movedFrom(clauses);
  const gone = unreadableIn(tree, [from.sha, at]);
  if (gone) {
    const flag = gone === from.sha ? from.flag : "--at";
    refuse(`git in ${tree} cannot read ${gone}, which ${flag} names, and \`landing moved\` is git's `
      + `reading of the --wrote paths between ${from.flag} and --at: no mark is written on a run's word for `
      + "it. Fetch that commit into this checkout, or mark from the one that holds it, then run this "
      + "again:\n  git fetch");
  }
  const read = movedBetween(tree, from.sha, at, wrote);
  if (read === null) refuse(`git in ${tree} could not diff ${from.sha} against ${at}, so nothing was written.`);
  if (moved === undefined) return { ...clauses, moved: read };
  if (sameReading(read, moved)) return clauses;
  return refuse(`--moved says ${pathsSaid(moved)}, and git reads ${pathsSaid(read)}: those are the paths `
    + `of --wrote whose bytes differ between the ${from.said} ${from.sha} and ${at}. The clause is that `
    + `reading, since it is what lets the verdicts at the judged head stand, so nothing was written. `
    + `Run it without --moved and the clause is git's reading:\n  ${again()}`);
};

/* The call a refused `--moved` is re-sent as: every flag the caller typed, as typed, and that one left out. */
const withoutMoved = (reference, given) => [`forge record merged ${typed(reference)}`,
  ...[...TYPED.map((one) => one.flag), "to"].filter((flag) => given[flag] !== undefined)
    .map((flag) => `--${flag} ${typed(given[flag])}`)].join(" ");

const branchFor = async (given) => {
  if (given.to !== undefined) return given.to;
  const held = (await releasePolicy())?.staging;
  if (held) return held;
  return refuse("record merged writes the branch the change landed on into the note, and this project's "
    + "config names no base branch to read it from. Name it with --to <branch>.");
};

/* `git show-ref --verify` on a name it holds no ref of exits fatally with this one sentence, never
 *  printed for any other failure — a corrupt ref database or git itself failing to start reads some
 *  other way, and is read below as an error and not as absence. */
const NO_SUCH_REF = /not a valid ref/u;

/* Whether `refs/remotes/origin/<ref>` names anything in this checkout: the same read `tipOf` in
 *  worklog.mjs makes, and its own comment says why the exact ref and not a revision (ISS-2841).
 *  `absent` is true only where the ref names nothing at all; a ref that exists but that git cannot
 *  peel to a commit, or a read that fails some other way, answers `absent: false, commit: null`
 *  instead — nothing here can tell and not nothing to check, the two read alike letting through the
 *  one case this branch exists to catch. */
const originTip = (ref, tree) => {
  const opts = { cwd: tree, encoding: "utf8" };
  const hash = spawnSync("git", ["show-ref", "--verify", "--hash", `refs/remotes/origin/${ref}`], opts);
  if (hash.status !== 0) return { absent: !hash.error && NO_SUCH_REF.test(hash.stderr ?? ""), commit: null };
  const commit = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${hash.stdout.trim()}^{commit}`], opts);
  return { absent: false, commit: commit.status === 0 ? commit.stdout.trim() : null };
};

/* What a builder is told instead of the mark: under a project whose ship mode leaves the landing to
 * another actor there is no route this run may take to land it, so it is told the mark is not its to
 * write; everywhere else the change is landed for real and the same mark asked for again. */
const notLandedRoute = (ref, branch) => (shipMode().value === "self"
  ? `Land it onto ${branch} for real — merge it and push — then mark it again:\n  ${mergedForm(ref)}`
  : "This project's ship mode leaves the landing to another actor, so marking this merged is not "
    + "the builder's to do: push the branch and leave the checkpoint for the landing to write the "
    + `mark instead:\n  forge claim ${ref} --pushed --ready`);

/* `--at` is checked against the base branch as this checkout has it fetched, `origin/<branch>`, and
 * never a local branch that may be stale (ISS-2841): a head that exists only on the builder's own
 * branch is no landing, however cleanly git can read it there. Where this checkout cannot even read
 * that branch — no remote of that name fetched here — there is nothing to refuse on and the mark
 * stands as it always has, the tracker's own "a claim Forge did not observe" line being what a
 * reader is already told. Where the branch is read but nothing here can tell whether it carries the
 * sha (a shallow history, or git erroring on the read), the refusal says so rather than guessing
 * either way. */
const cannotTell = (at, branch, tip, why) => refuse(`--at ${at} is checked against origin/${branch}`
  + `${tip ? ` (${shortSha(tip)})` : ""} as this checkout has it fetched, and nothing here can tell `
  + `whether it carries that commit: ${why}. Nothing was written until that reads for certain.`);

const baseCarries = (at, branch, ref) => {
  const tree = process.cwd();
  const origin = originTip(branch, tree);
  if (origin.absent) return;
  if (!origin.commit) {
    cannotTell(at, branch, null, `origin/${branch} names an object git could not read as a commit here`);
  }
  const read = commitCarries(at, origin.commit, tree);
  if (read.carries) return;
  if (read.carries === null) cannotTell(at, branch, origin.commit, read.why);
  refuse(`--at ${at} is refused: origin/${branch} stands at ${shortSha(origin.commit)} and does not `
    + `carry it, so this mark would claim a merge that never happened. ${notLandedRoute(ref, branch)}`);
};

/** What taking a stamp down says, whichever verb took it: `advance --set` repairing a close and
 *  `--undo` here are one unmark of one field, and two sentences for it read as two acts. */
export const stampRemoved = (ref) => `${ref}  the merged stamp is removed.`;

/* A stamp with no mark is what a close leaves: the tracker writes the row's field of its own accord and
   no mark of this issue's is on the page, so the removal has no note to quote and says where the stamp
   came from instead. Without this the one route to the tracker's unmerge is shut against exactly the
   rows that carry a landing nothing made, the mark being what `--undo` asked for (ISS-2125). */
const stampSaid = (ref, at) => `${stampRemoved(ref)} No mark on the page — the row carried a merged `
  + `stamp from ${at}, which no mark of this issue's wrote.`;

const markSaid = (ref, note) => `${ref}  the merged mark is removed. What it said:\n  ${note}`;

const undone = async (documentId, ref, said, { next, patch }) => {
  await renew(documentId, ref, next, patch);
  await unmarkMerged(documentId, ref);
  console.log(said);
};

/* What the row's commit field holds, said beside the note: empty is the tracker writing only a commit it observed, and its own sentence says which kind of mark this call left. */
const heldSaid = ({ answer, held }) => (held
  ? `The row's commit field holds ${held}.`
  : `The row's commit field is empty. The tracker's word on this mark: ${answer?.detail ?? "none given"}`);

const marked = async (documentId, ref, note, clauses, { next, patch }) => {
  await renew(documentId, ref, next, patch);
  const stamp = await markMerged(documentId, ref, note, { leased: true, commit: clauses.at });
  console.log(`${ref}  marked merged at ${clauses.at}, and \`${clause("moved").said}\` is git's reading `
    + `between ${movedFrom(clauses).sha} and ${clauses.at}: ${pathsSaid(clauses.moved)}. Its note:\n  ${note}`);
  console.log(heldSaid(stamp));
};

/* Every flag of the git mark, the three it reads from git or the config included: none of them means
   anything where the change landed in no repository, and one given there would be dropped unread. */
const GIT_FLAGS = [...CLAUSES.map((one) => one.flag), "to"];

/* The note an outside-git mark carries. The place itself is the tracker's own field, which its audit
   comment quotes beside this; the note says only which of the two marks this is. */
const LANDED_NOTE = "landed outside git, at the place this mark's landing names";

const outsideRefused = (reference, beside) => refuse(`${reference} lands outside git — the tracker's `
  + "`landingShape` for it is `outside_git` — so its mark names where the change now is and no commit"
  + (beside.length
    ? `: ${beside.map((one) => `--${one}`).join(", ")} ${beside.length === 1 ? "is a clause" : "are clauses"} of the git mark `
      + "and would be dropped unread, so nothing was written"
    : ", and this call names none, so nothing was written")
  + `. Name the landing:\n  ${landingForm(reference)}`);

const gitRefused = (reference) => refuse(`--landing names where a change landed outside git, and the `
  + `tracker says ${reference} lands in git, so its mark names the commit and the heads instead, and `
  + `nothing was written:\n  ${mergedForm(reference)}`);

const landed = async (documentId, ref, landing, { next, patch }) => {
  await renew(documentId, ref, next, patch);
  await markMerged(documentId, ref, LANDED_NOTE, { leased: true, landing });
  console.log(`${ref}  marked merged outside git, at ${landing}. Its note:\n  ${LANDED_NOTE}`);
};

/* The mark of an issue landing outside git: the landing and nothing else. */
const outsidePrepared = (given, { documentId, reference, next, patch }) => {
  const beside = GIT_FLAGS.filter((one) => given[one] !== undefined);
  if (given.landing === undefined || beside.length) outsideRefused(reference, beside);
  const landing = String(given.landing).trim();
  return { write: () => landed(documentId, reference, landing, { next, patch }) };
};

/** `forge record merged`: one flag per clause of the note, and `--undo` the one route back. Every
 *  refusal either form can earn is earned here, before the call this belongs to writes anything, and
 *  what comes back is the write. The usage the parser judges a stranger against is the kind's own
 *  `-h`, handed in: the rows read this module's clauses, and a read back would be a cycle. */
export const mergedPrepared = async (argv, { reference, issue, page, next, patch, usage } = {}) => {
  const given = flags(argv, "record merged", ["--undo"], { usage });
  const place = given.landing === undefined ? null : landingProblem(given.landing);
  if (place && !given.undo) refuse(`--landing ${place}.`);
  const { documentId, body } = await issue();
  if (given.undo) {
    const { comments } = await page();
    const also = Object.keys(given).filter((one) => one !== "undo");
    if (also.length) {
      refuse(`--undo removes the mark whole, so ${also.map((one) => `--${one}`).join(" and ")} `
        + "has no place beside it: a clause is written by the mark and not by its removal.");
    }
    const mark = lastMark(comments);
    if (!mark && !body?.mergedAt) {
      refuse(`${reference} carries no merged mark and its row carries no merged stamp, so there is `
        + `nothing to remove. What a mark is written with:\n  ${mergedForm(reference, body)}`);
    }
    const said = mark ? markSaid(reference, mark) : stampSaid(reference, body.mergedAt);
    return { write: () => undone(documentId, reference, said, { next, patch }) };
  }
  if (landsOutsideGit(body)) return outsidePrepared(given, { documentId, reference, next, patch });
  if (given.landing !== undefined) gitRefused(reference);
  const clauses = movedRead(clausesFrom(given), process.cwd(), () => withoutMoved(reference, given));
  const { comments } = await page();
  const { view, namedIn } = await viewOn(documentId, comments);
  judgedTruly(view, clauses.judged, (head) => withoutMoved(reference, { ...given, judged: head }));
  const branch = await branchFor(given);
  baseCarries(clauses.at, branch, reference);
  const note = markNote({ branch, ...clauses, named: namedIn(view), ref: reference });
  return { write: () => marked(documentId, reference, note, clauses, { next, patch }) };
};
