/* The path is R-19's to resolve, in plugin/src/checks/cited-paths.mjs, so what is asked here is the
   case; docs/requirements/README.md carries why a Proof names one (R-11, ISS-217). */
import { lineAt } from "../../markdown.mjs";
import { clausesOf } from "../parse.mjs";
import { suggest } from "../../suggest.mjs";

const TEST_FILE = /\.test\.mjs$/u;
const ESCAPED = /^none yet\b/u;
/* Non-greedy, so the key an escape is owed to is the first one written and never the last: a
   field carrying two keys is owed to nobody a reader can name, and the writer of the line read it
   left to right. */
const OWED_TO = /^none yet\b.*?\b(ISS-\d+)\b/u;
const NAMED = /^(\S+)(?:[^\S\n]+"(.*)")?$/u;
/* Anchored at the statement, or `PATTERN.test("a string")` would declare a case nobody wrote. */
const QUOTED = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`$\\]*)`/u;
const CALL = /^[^\S\n]*(?:await[^\S\n]+)?(?:t\.)?(?:test|it)(?:\.(?:only|skip|todo))?\([^\S\n]*/u;
const CASE = new RegExp(`${CALL.source}(?:${QUOTED.source})`, "gmu");

const ROUTES = "add the case's own name in double quotes after the path, or take R-11's escape —"
  + " `none yet` with the issue key that owes the case";

/** Every case a test file declares, in the file's own spelling. */
export const casesIn = (text) =>
  [...String(text ?? "").matchAll(CASE)].map((one) => one[1] ?? one[2] ?? one[3]);

/** `null` where the field is absent, `escaped` where it takes R-11's escape, and `name` is null on
 *  a bare path. */
export const proofOf = (value) => {
  const held = String(value ?? "").trim();
  if (!held) return null;
  if (ESCAPED.test(held)) return { path: null, name: null, held, escaped: true };
  const found = NAMED.exec(held);
  if (!found) return { path: null, name: null, held };
  return { path: found[1], name: found[2] ?? null, held };
};

/** The issue key an escape is owed to, or null where it names none. What became of that key is no
 *  part of this module: the shape is judged with no status in hand, so the gate and the suite answer
 *  the same way on a machine with no credential (AC-14-8-1). Who reads the status, and where:
 *  plugin/src/checks/docs/owing-escapes.mjs. */
export const owedTo = (value) => OWED_TO.exec(String(value ?? "").trim())?.[1] ?? null;

const lineOf = (text, id) => lineAt(text, text.indexOf(`**${id}**`));

/** Every criterion of one document that carries a Proof, as `{ id, proof, file, line }` with the
 *  field as written: the one reading of the tree's Proof lines, which the checker and the report
 *  reading them backwards both take, so neither can count a line the other does not. */
export const criteriaOf = ({ file, text }) =>
  clausesOf(text)
    .filter((clause) => clause.prefix === "AC" && clause.fields.Proof)
    .map((clause) => ({ id: clause.id, proof: clause.fields.Proof, file, line: lineOf(text, clause.id) }));

const nearest = (name, cases) => {
  const close = suggest(name, cases, 2);
  return close.length ? ` Nearest there: ${close.map((one) => `"${one}"`).join(", ")}.` : "";
};

const gone = (proof, cases) =>
  `names the case "${proof.name}" in ${proof.path}, which declares no case of that name.`
  + `${nearest(proof.name, cases)} Rename the case back, or name the case that proves this clause now`;

const problem = (proof, read, from) => {
  if (!proof) return null;
  if (proof.escaped) {
    return owedTo(proof.held) ? null
      : `takes R-11's escape and names no issue that owes the case: ${proof.held}. Name the issue`
        + " key beside it, so a clause left unproved is owed to something";
  }
  if (!proof.path) {
    return `has a Proof this checker cannot read: ${proof.held}. R-11's form is a path, then the`
      + " case's own name in double quotes where that path is a test file";
  }
  if (!TEST_FILE.test(proof.path)) {
    return proof.name
      ? `names a case in ${proof.path}, which is no test file and declares none: a checker that`
        + " proves a clause by running is cited by its path alone"
      : null;
  }
  const text = read(proof.path, from);
  if (text === null) return null;
  const cases = casesIn(text);
  if (!proof.name) {
    return `cites ${proof.path} and names no case in it, so nothing fails here when the case does: ${ROUTES}`;
  }
  return cases.includes(proof.name) ? null : gone(proof, cases);
};

/** `documents` is `{ file, text }`; `read` answers a cited path and the document that cited it with
 *  the text, or `null` where R-19's two bases reach no such file — which is R-19's finding to report
 *  and not this one's. */
export const proofProblems = (documents, read) =>
  documents.flatMap((document) =>
    criteriaOf(document).flatMap((clause) => {
      const said = problem(proofOf(clause.proof), read, clause.file);
      return said ? [`${clause.file}:${clause.line} ${clause.id} ${said}`] : [];
    }));

/** The tree's escapes inventoried for a caller that has to judge them: one row per criterion
 *  standing unproved, carrying where it is written and which clause it is beside what `owedTo` read
 *  off its field. A row whose `key` is null is `proofProblems`'s finding, not a caller's to report
 *  a second time. */
export const escapesIn = (documents) =>
  documents.flatMap((document) =>
    criteriaOf(document)
      .map((clause) => ({ clause, proof: proofOf(clause.proof) }))
      .filter(({ proof }) => proof?.escaped)
      .map(({ clause, proof }) => ({
        file: clause.file,
        line: clause.line,
        id: clause.id,
        key: owedTo(proof.held),
      })));
