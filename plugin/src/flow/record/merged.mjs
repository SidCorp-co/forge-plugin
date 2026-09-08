/* The merged mark, written and read in one place: the five clauses its note is built from, the
   reading each earns, and the one route that hangs a mark or takes it down. Together because the
   note is prose on the wire, and a second spelling of a clause puts a sha in the slot the next
   status reads for another one. docs/cli/record-merged.md. */
import { refuse } from "../../refusal.mjs";
import { flags } from "../../resolve/flags.mjs";
import { commentPage, creditAfter } from "../../tracker/comments.mjs";
import { isCommit } from "../../tracker/evidence.mjs";
import { capsOf, lengthOf } from "../../tracker/field-write.mjs";
import { documentIdOf } from "../../tracker/issues.mjs";
import { releasePolicy } from "../../tracker/project-config.mjs";
import { scoped, write } from "../../tracker/rest.mjs";
import { notAnothers, renew } from "../lease.mjs";
import { unwrap } from "../machine.mjs";

/* The tracker's own audit comment for the mark opens on the action's name, and that is what tells a
   mark apart from a comment quoting one. */
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
  { flag: "judged", said: "judged head", label: "the head the verdicts judged", commit: true },
  { flag: "moved", said: "landing moved", label: "the paths of this change the landing moved" },
  { flag: "wrote", said: "landing wrote", label: "the paths this change itself landed" },
].map((one) => ({ ...one, reads: one.commit ? shaOf(one.said) : clauseOf(one.said) }));

const clause = (flag) => CLAUSES.find((one) => one.flag === flag);

/** The note of the mark that stands: the latest, a re-mark after a second landing being the one
 *  that landed. */
export const lastMark = (comments) => {
  const marks = (comments ?? []).map((one) => unwrap(one.body)).filter((body) => MARK.test(body));
  return marks.length ? marks.at(-1) : null;
};

/* What the standing mark says in one clause, or null where it says nothing there. */
const readClause = (comments, flag) => clause(flag).reads.exec(lastMark(comments) ?? "")?.[1] ?? null;

export const markedCommit = (comments) => readClause(comments, "at");
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
export const landingWrote = (comments) => readPaths(comments, "wrote");

/* What the clauses are joined by, so a path holding one reads as its clause ending there and a `moved` with one path in it reads as none moved, which is the reading a status acts on. Refused at the composer rather than at the flag, because the landing task composes a note too. */
const APART = /[;\n]/u;

const pathsSaid = (paths) => {
  const held = paths ?? [];
  const barred = held.find((one) => APART.test(one) || one.includes(","));
  if (barred) {
    refuse(`\`${barred}\` cannot travel in the mark's note: the note's clauses are separated by \`;\` `
      + "and the paths in one by `,`, so a reader would take part of this path for another clause or "
      + "another path. Name the directory it is under, or the path without the separator.");
  }
  const said = held.length ? held.join(", ") : NOTHING;
  if (held.length && NONE.test(said)) {
    refuse(`\`${said}\` is the word this clause takes for no paths at all, so a path of that name `
      + "cannot travel in the note: it would read back as a landing that moved none of them, which "
      + "is what lets the verdicts stand. Name it some other way — the directory it is under, or the "
      + "path with its extension.");
  }
  return said;
};

/* A whole path or nothing, prefixes included; a trailing dot ends a sentence unless a name follows. Beside the note rather than beside the check that spends it, because the composer asks the same question of the same text before it leaves a path out. */
export const namesPath = (named, path) =>
  new RegExp(`(?<![\\w./-])${path.replace(/[$()*+.?[\\\]^{|}]/gu, "\\$&")}(?![\\w/-])(?!\\.\\w)`, "u").test(named);

/** The write that names a path the plan does not, spelt once: the mark's own refusal and `developed`'s shortfall both spend it, and two spellings would send a run to two commands. */
export const correctionForm = (ref, paths) =>
  `forge record correction ${ref} --moved "the change also wrote ${paths.join(", ")}" `
  + `--why "<why each was needed>"`;

/** The text `developed` reads each path of the note against — the plan and its corrections — for the composer that must not leave out what that check would refuse. The import is at the call because `earned.mjs` reads this module's clauses, so a static one back would be a cycle. */
export const namedFor = async (documentId, comments = null) => {
  const { namedIn, viewFrom } = await import("../earned.mjs");
  const issue = await scoped("forge_issues", { action: "get", documentId, fields: ["plan"] });
  const page = comments ?? (await commentPage(documentId)).comments ?? [];
  return namedIn(viewFrom(documentId, issue ?? {}, page ?? []));
};

const sentenceOf = ({ branch, at, reviewed, judged, moved, wrote, tail = "" }) =>
  `merged to ${branch} ${clause("at").said} ${at}; ${clause("reviewed").said} ${reviewed}; `
  + `${clause("judged").said} ${judged}; ${clause("moved").said} ${pathsSaid(moved)}; `
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

/* Every path the plan does not name stays in the clause and the ones it names fill what room is left, so `developed` reads the set it would have read off the whole list: what is left out is what that check already passes. A change whose unnamed paths alone overrun the note is refused rather than quietly shortened, because shortening there would earn the status a change that grew has not. No plan at all is a change `developed` reads no path of against anything, so the tier that writes none is excused the check and this refusal both. The floor is measured on the shortest path and a path the room cannot take is passed over rather than ending the fill, because a long one first would blame `landing moved` for a note a shorter path fits in. */
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
  ? one.reads.exec(note)?.[1] ?? null
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

/** The mark, and the audit comment it causes credited in the same breath: the next write to the issue is refused for a comment nothing has read, and every route that causes one clears it. The lease is checked here rather than only at the call site because the landing task marks a merge too, holding a lease this must not renew — a renewal would rewrite the landing state saved a step before it — so a check no caller can reach the write without is a read and not a renewal. `leased` is the caller that renewed a moment ago, whose renewal was that read. */
export const markMerged = async (documentId, ref, note, { leased = false } = {}) => {
  if (!leased) await notAnothers(documentId, ref);
  const answer = await write("forge_issues",
    { action: "mark_merged", data: { issueId: documentId, target: TARGET, note } });
  await creditAfter("the merged mark", [{ ref, documentId }]);
  return answer;
};

export const unmarkMerged = async (documentId, ref) => {
  await notAnothers(documentId, ref);
  const answer = await write("forge_issues", { action: "unmark", data: { issueId: documentId } });
  await creditAfter("the unmark", [{ ref, documentId }]);
  return answer;
};

const flagSaid = (one) => `--${one.flag} <${one.label}>`;

export const mergedForm = (ref) =>
  `forge record merged ${ref} ${CLAUSES.map(flagSaid).join(" ")}`;

export const undoForm = (ref) => `forge record merged ${ref} --undo`;

const valueOf = (one, given) => {
  if (one.commit) {
    if (!isCommit(given)) {
      refuse(`--${one.flag} takes ${one.label} as 7 to 40 hex digits, not \`${given}\`.`);
    }
    return given;
  }
  const paths = pathsIn(given);
  if (paths === null) {
    refuse(`--${one.flag} takes ${one.label}, separated by commas, or the word \`${NOTHING}\`; `
      + `\`${given}\` parses to no path at all.`);
  }
  return paths;
};

/* Every missing clause at once. The shape's own loop refuses on the first, which costs a round per
   flag, and the mark is the one payload whose flags a run types five of (ISS-680). */
const clausesFrom = (given) => {
  const absent = CLAUSES.filter((one) => given[one.flag] === undefined);
  if (absent.length) {
    refuse(`record merged needs ${absent.map((one) => `--${one.flag}`).join(", ")}, `
      + `${absent.length === 1 ? "which is a clause" : "which are clauses"} of the mark's note and `
      + `${absent.length === 1 ? "has" : "have"} no default:\n  ${mergedForm("<uuid|ISS-45>")}`);
  }
  return Object.fromEntries(CLAUSES.map((one) => [one.flag, valueOf(one, given[one.flag])]));
};

const branchFor = async (given) => {
  if (given.to !== undefined) return given.to;
  const held = (await releasePolicy())?.staging;
  if (held) return held;
  return refuse("record merged writes the branch the change landed on into the note, and this project's "
    + "config names no base branch to read it from. Name it with --to <branch>.");
};

const undone = async (documentId, ref, { next, patch }) => {
  const { comments } = await commentPage(documentId);
  const held = lastMark(comments);
  if (!held) {
    refuse(`${ref} carries no merged mark, so there is nothing to remove. What a mark is written `
      + `with:\n  ${mergedForm(ref)}`);
  }
  await renew(documentId, ref, next, patch);
  await unmarkMerged(documentId, ref);
  console.log(`${ref}  the merged mark is removed. What it said:\n  ${held}`);
};

/** `forge record merged`: one flag per clause of the note, and `--undo` the one route back. The usage the parser judges a stranger against is the kind's own `-h`, handed in by the dispatcher: the rows live beside the verb table, which reads this module's clauses, and a read back the other way would be a cycle. */
export const recordMerged = async (reference, argv, { next, patch, usage } = {}) => {
  const given = flags(argv, "record merged", ["--undo"], { usage });
  const documentId = await documentIdOf(reference);
  if (given.undo) {
    const also = Object.keys(given).filter((one) => one !== "undo");
    if (also.length) {
      refuse(`--undo removes the mark whole, so ${also.map((one) => `--${one}`).join(" and ")} `
        + "has no place beside it: a clause is written by the mark and not by its removal.");
    }
    return undone(documentId, reference, { next, patch });
  }
  const held = clausesFrom(given);
  const note = markNote({ branch: await branchFor(given), ...held,
    named: await namedFor(documentId), ref: reference });
  await renew(documentId, reference, next, patch);
  await markMerged(documentId, reference, note, { leased: true });
  console.log(`${reference}  marked merged at ${held.at}. Its note:\n  ${note}`);
  return null;
};
