/* The Proof lines read backwards, from the test files to the criteria: which criteria are still
   owed a case, which test files no criterion names, which cases more than one criterion names. The
   lines are read by the one parser the checker reads them with, and nothing here is stored, so the
   map has one source and it is the tree (ISS-2503). Handed every text it reads, it touches no disk. */
import { posix } from "node:path";

import { lineAt } from "../../markdown.mjs";
import { casesIn, criteriaOf, escapesIn, proofOf } from "../claims/proof.mjs";

/* R-19's two bases in R-19's order: the citing document's own directory, then the repository root. */
const namedPath = (path, from, exists) => {
  const beside = posix.normalize(posix.join(posix.dirname(from), path));
  return exists(beside) ? beside : posix.normalize(path);
};

/* The line the text's end falls on, less the empty one a closing newline opens. */
const linesIn = (text) => (text ? lineAt(text, text.length) - (text.endsWith("\n") ? 1 : 0) : 0);

const byLines = (one, two) => two.lines - one.lines || two.cases - one.cases || one.path.localeCompare(two.path);

/** Each escape beside what became of the issue it names. `statusOf` answers a key with its status,
 *  or null where the reading could not say; `owes` answers a status with whether that issue still
 *  owes the case. */
const unprovenOf = (documents, statusOf, owes) => escapesIn(documents).map((one) => {
  const status = one.key ? statusOf(one.key) : null;
  return { ...one, status, owes: status === null ? null : owes(status) };
});

const unnamedOf = (tests, named) => tests
  .filter((one) => !named.has(posix.normalize(one.path)))
  .map((one) => ({ path: one.path, lines: linesIn(one.text), cases: casesIn(one.text).length }))
  .sort(byLines);

const sharedOf = (cited) => {
  const held = new Map();
  for (const one of cited.filter((row) => row.name)) {
    const key = `${one.path}\n${one.name}`;
    const row = held.get(key) ?? { path: one.path, name: one.name, criteria: [] };
    if (!row.criteria.includes(one.id)) row.criteria.push(one.id);
    held.set(key, row);
  }
  return [...held.values()].filter((one) => one.criteria.length > 1)
    .sort((one, two) => two.criteria.length - one.criteria.length || one.path.localeCompare(two.path));
};

/** The three lists, or `{ proofs: 0 }` where no criterion carries a Proof at all. `documents` is
 *  `{ file, text }`; `tests` is `{ path, text }` for every file the project's test root and pattern
 *  name, or null where it declared neither; `exists` answers a repository-relative path. */
export const proofsRead = ({ documents, tests, statusOf = () => null, owes = () => null, exists = () => false }) => {
  const rows = documents.flatMap(criteriaOf);
  if (!rows.length) return { proofs: 0 };
  const cited = rows.map((one) => ({ ...one, ...proofOf(one.proof) }))
    .filter((one) => one.path)
    .map((one) => ({ ...one, path: namedPath(one.path, one.file, exists) }));
  return {
    proofs: rows.length,
    unproven: unprovenOf(documents, statusOf, owes),
    unnamed: tests ? unnamedOf(tests, new Set(cited.map((one) => one.path))) : null,
    shared: sharedOf(cited),
  };
};
