/* What a write outside the tree owes it, in one place: `forge record plan` over a plan's whole text, `forge record criteria` over each criterion's opening (AC-14-4-1), and the transition asking whether an issue names a clause at all (AC-14-4-2). The wording is `citation.mjs`'s and the storage is `tree.mjs`'s; what is decided here is which span each caller hands over, and `raise` is the caller's own because the verb exits where the record throws. The text is asked before the project is (ISS-428): a text naming no identifier has nothing to resolve, and building the index for it reads and parses every document of the tree to answer nothing. That order is also the one place this check is not invisible — where the tree is unreadable, a write citing nothing stores, because it makes no traversal it has no reason to make. */
import { citationProblems, citationRefusal, revisionSaid, unrevisionedIn } from "./citation.mjs";
import { citationsIn, identifiersIn, opensWith } from "./parse.mjs";
import { keepsSpecTree, specTreeIfAny } from "./tree.mjs";
import { lookup } from "./index.mjs";

export const citationsChecked = (text, raise) => {
  const ids = identifiersIn(text);
  if (!ids.length) return;
  const index = specTreeIfAny();
  if (!index) return;
  const refusal = citationRefusal(citationProblems(index, ids));
  if (refusal) raise(refusal);
  const said = revisionSaid(unrevisionedIn(index, ids));
  if (said) console.error(said);
};

/** An identifier further into a criterion is prose and settles nothing, and where no criterion opens with one nothing is read, so a verb that walked no tree does not start. */
export const criteriaChecked = (criteria, raise) => {
  const opened = criteria.map((one) => opensWith(one.text)).filter(Boolean);
  const written = (one) => `${one.id}${one.rev === null ? "" : `~${one.rev}`}`;
  if (opened.length) citationsChecked(opened.map(written).join("\n"), raise);
};

/** The three fields a write can put a citation into, each with the words a reader is given for it, in one table: the check that reads them and the help a file is written against would otherwise come to name different fields. The tracker's own wrapping of them carries no identifier of its own. */
export const CITED_FIELDS = [
  { field: "description", named: "the description" },
  { field: "plan", named: "the plan" },
  { field: "acceptanceCriteria", named: "the criteria" },
];

const NAMED = CITED_FIELDS.map(({ named }) => named);

export const CITED_IN = `${NAMED.slice(0, -1).join(", ")} or ${NAMED.at(-1)}`;

/** What a run has to know before it writes the file rather than after the entry check turns it back, which is where this demand was stated and nowhere else: by then a consult has read the file, the write compares it with what that consult was given, and the citation costs a second one (ISS-516). Empty where the project keeps no tree, the demand being the project's and not the method's. */
export const citationBlocks = (keeps = keepsSpecTree()) => (keeps
  ? ["This project keeps a requirements tree, and `approved` is refused until one of",
    `${CITED_IN} names a clause of it. A criterion carries one by`,
    "opening with `<id>~<rev>:`, and `forge spec <id>` prints the clause with the revision to cite.",
    "Write it into the file the consult reads: this write compares the file with what that consult was",
    "given, so a citation added afterwards is a second consult."]
  : []);

/** The clauses an issue names, resolved rather than recognised: a prefix and a revision make an identifier, not a clause. `null` is a project keeping no tree and is the one answer that turns the condition off; `[]` is a tree with nothing cited. */
export const citedClauses = (issue) => {
  const index = specTreeIfAny();
  if (!index) return null;
  const text = CITED_FIELDS.map(({ field }) => issue?.[field]).join("\n");
  return [...new Set(citationsIn(text).filter((one) => lookup(index, one.id).clause).map((one) => one.id))];
};
