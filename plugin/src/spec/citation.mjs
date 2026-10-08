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

/** Whether an identifier names the clause it resolves to: by its revision where the clause carries one, and bare where it carries none, which is the only form such a clause has. A bare identifier of a revisioned clause names nothing, because R-10's digest is keyed on the revision. The write's said line, the `approved` check and the citing set read this one rule, so no write stores a citation the check then fails to count. */
export const namesClause = (clause, one) => one.rev !== null || clause.rev === null;

/** The clauses `ids` name by that rule, each once. */
export const namedIn = (index, ids) => [...new Set(ids
  .filter((one) => {
    const { clause } = lookup(index, one.id);
    return clause && namesClause(clause, one);
  })
  .map((one) => one.id))];

/** Said and never refused: the bare identifiers of clauses that carry a revision, each with that revision, since a plan names identifiers in prose. */
export const unrevisionedIn = (index, ids) => [...new Map(ids
  .map((one) => ({ one, clause: lookup(index, one.id).clause }))
  .filter(({ one, clause }) => clause && !namesClause(clause, one))
  .map(({ one, clause }) => [one.id, { id: one.id, rev: clause.rev }])).values()];

/** `escape` is the caller's closing line: the one reader that skips quoted text says how to quote. */
export const citationRefusal = (problems, escape = null) => (problems.length
  ? ["This citation does not resolve against this project's requirements tree, so nothing was written:",
    ...problems.map((one) => `  ${one}`), ...(escape ? [escape] : [])].join("\n")
  : null);

export const revisionSaid = (ids) => {
  if (!ids.length) return null;
  const many = ids.length > 1;
  const names = ids.map((one) => one.id).join(", ");
  const cites = ids.map((one) => `${one.id}~${one.rev}`).join(", ");
  return `${names} ${many ? "name clauses that carry" : "names a clause that carries"} a revision and`
    + ` ${many ? "were" : "was"} written without it, which \`approved\` does not count as naming the`
    + ` clause: cite ${cites}. R-10 asks for \`<id>~<rev>\`, so a clause that is reworded takes its citations`
    + " with it, and this was written as given.";
};
