/* A citation resolved against the tree — written outside it in a plan or a criterion, or, through
   `revisionFix` alone, inside one of the tree's own documents. The notation is `parse.mjs`'s, the
   ways a reference fails `index.mjs`'s, and R-10 is why a citation carries a revision. */
import { didYouMean } from "../suggest.mjs";
import { FORMS } from "./parse.mjs";
import { lookup } from "./index.mjs";

/** What clears an identifier two documents define — not retiring one, which keeps its number (R-12). */
const ONE_HOME = "and an identifier names one clause. One of the two is a definition that"
  + " should be a reference: keep the clause in one document and cite it from the other.";

/** What to do about a citation whose revision does not resolve, or `null` where it does — the tail of the sentence alone, so a refusal can open with the citation and a gate finding with the line it sits on. */
export const revisionFix = (clause, one) => {
  if (clause.rev === null) {
    return `names a revision and ${one.id} carries none: its table has no Rev column. Cite it as`
      + ` ${one.id}`;
  }
  if (clause.rev === one.rev) return null;
  return `is stale: ${one.id} is at revision ${clause.rev}, not ${one.rev}. Read it with \`forge spec`
    + ` ${one.id}\` and cite ${one.id}~${clause.rev} if it still says what you meant`;
};

const revisionProblem = (clause, one) => {
  const fix = revisionFix(clause, one);
  return fix === null ? null : `The citation ${one.id}~${one.rev} ${fix}.`;
};

/** The three ways an identifier names no one clause, for both readers that ask: this file returns the sentence and `forge spec` refuses on it, `verb` is how each hands the forms back, and the clause rides along so neither pays a second lookup. The revision is not judged here — a stale one still prints its clause. */
export const lookupProblem = (index, id, verb) => {
  const found = lookup(index, id);
  if (found.ambiguous) {
    const what = found.via ? `${id} sits under ${found.via}, which is` : `${id} is`;
    return { problem: `${what} defined in ${found.ambiguous.join(" and ")}, ${ONE_HOME}`, clause: null };
  }
  if (found.foreign) {
    return { problem: `${id} names ${found.foreign}, which is not a clause of the specification. ${verb} one`
      + ` of ${FORMS}.`, clause: null };
  }
  if (!found.clause) {
    return { problem: didYouMean("clause", id, found.nearest, `The forms are ${FORMS}.`), clause: null };
  }
  return { problem: null, clause: found.clause };
};

const problemOf = (index, one) => {
  const { problem, clause } = lookupProblem(index, one.id, "Cite");
  return problem ?? revisionProblem(clause, one);
};

/** One sentence per identifier of `ids` carrying a revision that does not resolve against `index`. The parsed list is the unit, never the text behind it, which the caller has already read once. */
export const citationProblems = (index, ids) =>
  [...new Map(ids.filter((one) => one.rev !== null).map((one) => [`${one.id}~${one.rev}`, one])).values()]
    .map((one) => problemOf(index, one))
    .filter(Boolean);

/** Said and never refused: an identifier with no revision makes no claim a checker could fail. */
export const unrevisionedIn = (index, ids) => [...new Set(ids
  .filter((one) => one.rev === null && lookup(index, one.id).clause)
  .map((one) => one.id))];

export const citationRefusal = (problems) => (problems.length
  ? ["This citation does not resolve against this project's requirements tree, so nothing was written:",
    ...problems.map((one) => `  ${one}`)].join("\n")
  : null);

export const revisionSaid = (ids) => {
  if (!ids.length) return null;
  const names = ids.length > 1 ? `${ids.join(", ")} name clauses and carry` : `${ids[0]} names a clause and carries`;
  return `${names} no revision. R-10 asks for \`<id>~<rev>\`, so a clause that is reworded takes its`
    + " citations with it: only a citation carrying a revision is compared with the digest the tree"
    + " records, and this was written as given.";
};
