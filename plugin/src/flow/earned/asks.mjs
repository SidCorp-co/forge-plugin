/* The writes an entry check names beside each shortfall. Apart from earned.mjs, which reads the
   record; these only spell what supplies it. */
import { VERDICTS, need, valuesOf } from "../machine.mjs";
import { typed } from "../../hooks/shell-spans.mjs";
import { markedIdentity } from "../record/merged.mjs";
import { identityAsk, landsOutsideGit, markedLanding, samePlace } from "../record/judged/landing.mjs";

/* The identity every ask spends: a commit in git, the mark's landing outside it (ISS-2402). */
export const identityOf = (view) => markedIdentity(view.issue, view.comments);
export const idAsk = (view) => identityAsk(identityOf(view));

/* The identity asked of a verdict whose answer has no commit on the record yet: a placeholder sha in
   git, and outside git the landing, which stands before anything is judged. */
export const unreadId = (view) => (landsOutsideGit(view.issue) ? idAsk(view) : "--commit <sha>");

/* One naming any other place, or a commit, judged something the mark does not say landed. */
export const landingOwed = (view, held, what, ask) => {
  const merged = markedLanding(view.issue);
  if (!merged || samePlace(held.landing, merged)) return [];
  const read = held.landing === undefined ? `the commit ${held.commit}` : `the landing ${held.landing}`;
  return [need(`${what} ${read}, and the merged mark says this change landed at ${merged}`, ask)];
};

/* The same question of an issue landing in git, where a record naming only a landing names no commit. */
export const identityOwed = (view, held, what, ask) => {
  if (landsOutsideGit(view.issue)) return landingOwed(view, held, what, ask);
  if (held.commit !== undefined) return [];
  return [need(`${what} the landing ${held.landing}, and this issue lands in git, so nothing on it names a commit`, ask)];
};

/* Both verdict shortfalls fold here, so neither drifts into the other's shape (ISS-297): several
   criteria are one item and one write, shared flags before the first --criterion `blocksIn` splits on. */
export const askOne = (ref, number, id) =>
  `forge record verdict ${ref} --criterion ${number} --verdict ${valuesOf("verdict", "verdict")} `
  + `${id} --evidence <attachment|url|sha>`;
const askAll = (ref, numbers, id) =>
  `forge record verdict ${ref} ${id} --evidence <attachment|url|sha> `
  + `--verdict ${valuesOf("verdict", "verdict")}` + numbers.map((number) => ` --criterion ${number}`).join("");
/* Each criterion a block of its own carrying what it holds, for an ask whose judgement stands and
   only its citation is owed: one placeholder shared by every block is filled with one value, and the
   run filling it turns each reasoned skip into whatever it typed (ISS-2252). A criterion holding no
   value is given the placeholder, never a value nobody judged. `held` pairs a number with its fields. */
export const heldBlocks = (held) => held.map(([number, fields]) => {
  if (!VERDICTS.includes(fields?.verdict)) return ` --criterion ${number} --verdict ${valuesOf("verdict", "verdict")}`;
  return ` --criterion ${number} --verdict ${fields.verdict}`
    + (fields.why ? ` --why ${typed(String(fields.why))}` : "")
    + (fields.filed ? ` --filed ${typed(String(fields.filed))}` : "");
}).join("");

export const foldVerdicts = (ref, numbers, id, one, many) =>
  (numbers.length > 1
    ? [need(many(numbers.join(", ")), askAll(ref, numbers, id))]
    : numbers.map((number) => need(one(number), askOne(ref, number, id))));

/* A criterion the judgement proved impossible is corrected in the open rather than left to wait on
   a verdict that can never come — `forge guide contract testing`'s own sentence, and the route
   ISS-2362 names. Exported and read by `route.mjs`'s own advisory too, so the one line spelling the
   two writes cannot drift between the two callers (ISS-2430 review, F1). The correction record alone
   moves nothing on the field itself — ISS-1741 is open on exactly that gap — so the second write is
   named beside it rather than assumed, and `--replace` with it since the route this need is for is
   dropping a number the write otherwise refuses to lose silently. */
export const correctedForm = (ref, number) =>
  `forge record correction ${ref} --corrects criteria:${number} --moved "<the criterion as corrected>" `
  + `--why "<the finding that showed it, or why no route ever reaches it>", then forge record criteria `
  + `${ref} <criteria.md> --replace`;

/* The commit judged and never the merged one: filling in the merged commit asks the judge to cite one
   they did not look at. Their write, from a checkout holding both, records that it carries it (ISS-1302). */
export const carriedAsk = (ref, number, merged) =>
  `${askOne(ref, number, `--commit <the commit you judged, carrying ${merged}>`)}, from a checkout that holds both`;

export const verificationForm = (ref, id, evidence, tail = "") =>
  `forge record verification ${ref} --where "<where it runs>" ${id} `
  + `--evidence ${evidence}${tail}`;
