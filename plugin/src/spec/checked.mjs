/* What a write outside the tree owes it, in one place: `forge plan` over a plan's whole text, `forge record criteria` over each criterion's opening (AC-14-4-1), and the transition asking whether an issue names a clause at all (AC-14-4-2). The wording is `citation.mjs`'s and the storage is `tree.mjs`'s; what is decided here is which span each caller hands over, and `raise` is the caller's own because the verb exits where the record throws. The text is asked before the project is (ISS-428): a text naming no identifier has nothing to resolve, and building the index for it reads and parses every document of the tree to answer nothing. That order is also the one place this check is not invisible — where the tree is unreadable, a write citing nothing stores, because it makes no traversal it has no reason to make. */
import { citationProblems, citationRefusal, revisionSaid, unrevisionedIn } from "./citation.mjs";
import { citationsIn, identifiersIn, opensWith } from "./parse.mjs";
import { hasTree, specTree } from "./tree.mjs";
import { lookup } from "./index.mjs";

export const citationsChecked = (text, raise) => {
  const ids = identifiersIn(text);
  if (!ids.length || !hasTree()) return;
  const index = specTree();
  const refusal = citationRefusal(citationProblems(index, text, ids));
  if (refusal) raise(refusal);
  const said = revisionSaid(unrevisionedIn(index, text, ids));
  if (said) console.error(said);
};

/** An identifier further into a criterion is prose and settles nothing, and where no criterion opens with one nothing is read, so a verb that walked no tree does not start. */
export const criteriaChecked = (criteria, raise) => {
  const opened = criteria.map((one) => opensWith(one.text)).filter(Boolean);
  const written = (one) => `${one.id}${one.rev === null ? "" : `~${one.rev}`}`;
  if (opened.length) citationsChecked(opened.map(written).join("\n"), raise);
};

/** The clauses an issue names, resolved rather than recognised: a prefix and a revision make an identifier, not a clause. `null` is a project keeping no tree and is the one answer that turns the condition off; `[]` is a tree with nothing cited. The three fields are the ones a write can put a citation into, and the tracker's own wrapping of them carries no identifier of its own. */
export const citedClauses = (issue) => {
  if (!hasTree()) return null;
  const index = specTree();
  const text = [issue?.description, issue?.plan, issue?.acceptanceCriteria].join("\n");
  return [...new Set(citationsIn(text).filter((one) => lookup(index, one.id).clause).map((one) => one.id))];
};
