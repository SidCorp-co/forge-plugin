/* Documents to one entry per identifier, and the two directions a phase asks for: down to the
   clauses a clause holds, and back from a business rule to the clauses carrying it out. */
import { FOREIGN, clausesOf } from "./parse.mjs";
import { suggest } from "../suggest.mjs";

const link = (clauses) => {
  for (const clause of clauses.values()) {
    for (const parent of clause.parents) clauses.get(parent)?.children.push(clause.id);
    for (const rule of clause.enforces) clauses.get(rule)?.enforcedBy.push(clause.id);
  }
};

/** `documents` is `{ file, text }` — an identifier defined twice is kept once and recorded as
 *  ambiguous, because a reader that silently picked one would answer a citation with the wrong
 *  clause and nothing downstream could tell. */
export const clauseIndex = (documents) => {
  const clauses = new Map();
  const duplicates = new Map();
  const order = [];
  for (const { file, text } of documents) {
    for (const clause of clausesOf(text)) {
      const held = clauses.get(clause.id);
      if (held) {
        duplicates.set(clause.id, [...(duplicates.get(clause.id) ?? [held.file]), file]);
        continue;
      }
      clauses.set(clause.id, { ...clause, file });
      order.push(clause.id);
    }
  }
  link(clauses);
  return { clauses, duplicates, order };
};

export const nearest = (index, id) => suggest(id, [...index.clauses.keys()]);

/* A clause under an ambiguous identifier is ambiguous too: both documents number their own
   children, and the one kept was whichever document was read first. */
const ambiguousAbove = (index, id) => {
  const seen = new Set([id]);
  for (let held = index.clauses.get(id); held; held = index.clauses.get(held.parents[0])) {
    const parent = held.parents[0];
    if (!parent || seen.has(parent)) return null;
    seen.add(parent);
    if (index.duplicates.has(parent)) return { via: parent, files: index.duplicates.get(parent) };
  }
  return null;
};

export const lookup = (index, id) => {
  if (index.duplicates.has(id)) return { ambiguous: index.duplicates.get(id), via: null };
  const clause = index.clauses.get(id);
  if (clause) {
    const above = ambiguousAbove(index, id);
    return above ? { ambiguous: above.files, via: above.via } : { clause };
  }
  const prefix = id.split("-")[0];
  if (FOREIGN[prefix]) return { foreign: FOREIGN[prefix] };
  return { nearest: nearest(index, id) };
};

export const clauseOf = (index, id) => index.clauses.get(id) ?? null;

/** The clause and everything under it, in document order. A child two documents define is left to
 *  `ambiguousUnder`: whichever copy was read first is the wrong clause under a right identifier. */
export const withDescendants = (index, id) => {
  const held = clauseOf(index, id);
  if (!held) return [];
  const kept = held.children.filter((child) => !index.duplicates.has(child));
  return [held, ...kept.flatMap((child) => withDescendants(index, child))];
};

export const ambiguousUnder = (index, id) => {
  const held = clauseOf(index, id);
  if (!held) return [];
  return held.children.flatMap((child) =>
    (index.duplicates.has(child) ? [child] : ambiguousUnder(index, child)));
};
