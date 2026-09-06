/* A citation written outside the tree — in a plan, in a criterion — resolved against it. The
   notation is `parse.mjs`'s, the ways a reference fails are `index.mjs`'s, and R-10 in
   `docs/requirements/README.md` is why one carries a revision. No file is read here. */
import { didYouMean } from "../suggest.mjs";
import { FORMS, identifiersIn } from "./parse.mjs";
import { lookup } from "./index.mjs";

/** What clears an identifier two documents define — not retiring one, which keeps its number (R-12). */
export const ONE_HOME = "and an identifier names one clause. One of the two is a definition that"
  + " should be a reference: keep the clause in one document and cite it from the other.";

const revisionProblem = (clause, one) => {
  if (clause.rev === null) {
    return `The citation ${one.id}~${one.rev} names a revision and ${one.id} carries none: its table`
      + ` has no Rev column. Cite it as ${one.id}.`;
  }
  if (clause.rev === one.rev) return null;
  return `The citation ${one.id}~${one.rev} is stale: ${one.id} is at revision ${clause.rev}, not`
    + ` ${one.rev}. Read it with \`forge spec ${one.id}\` and cite ${one.id}~${clause.rev} if it`
    + " still says what you meant.";
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

const once = (entries, key) => [...new Map(entries.map((one) => [key(one), one])).values()];

/** One sentence per citation of `text` not resolving against `index`, naming its fix. A citation is
 *  `<id>~<rev>`; a bare identifier makes no checkable claim, and is `unrevisionedIn`'s. */
export const citationProblems = (index, text, ids = identifiersIn(text)) =>
  once(ids.filter((one) => one.rev !== null), (one) => `${one.id}~${one.rev}`)
    .map((one) => problemOf(index, one))
    .filter(Boolean);

/** Said and never refused until ISS-27's gate compares the recorded hash. */
export const unrevisionedIn = (index, text, ids = identifiersIn(text)) =>
  once(
    ids.filter((one) => one.rev === null && lookup(index, one.id).clause),
    (one) => one.id,
  ).map((one) => one.id);

export const citationRefusal = (problems) => (problems.length
  ? ["This citation does not resolve against this project's requirements tree, so nothing was written:",
    ...problems.map((one) => `  ${one}`)].join("\n")
  : null);

export const revisionSaid = (ids) => {
  if (!ids.length) return null;
  const names = ids.length > 1 ? `${ids.join(", ")} name clauses and carry` : `${ids[0]} names a clause and carries`;
  return `${names} no revision. R-10 asks for \`<id>~<rev>\`, so a clause that is reworded takes its`
    + " citations with it; nothing compares the hash yet (ISS-27) and this was written as given.";
};
