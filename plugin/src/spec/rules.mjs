/* The rules of the tree that are about identifiers: what the index answers, plus the document text
   for the line a finding sits on and the rows no clause holds. Every rule is stated in
   `docs/requirements/README.md` and named by its number here, so the finding a developer reads
   sends them to the one place the rule is written. Nothing here opens a file — `tree.mjs` is the
   one module that touches the checkout — which is why a fixture proves each of these. */
import { lineAt } from "../line-at.mjs";
import { TABLE_ROW_PATTERN, TABLE_SEPARATOR_PATTERN, withoutSpans } from "../markdown.mjs";
import { identifiersIn } from "./parse.mjs";
import { lookup } from "./index.mjs";

const INDEX_FILE = "srs/README.md";
const RULES_FILE = "README.md";
const BUSINESS_RULES = "brd/04-business-rules.md";
const OPEN_ITEMS = "brd/08-open-items.md";
const REQUIREMENT_FILE = /(?:^|\/)fr-(\d+)-[^/]*\.md$/u;
const RULE_ROW = /^\|\s*(R-\d+)\s*\|/u;
const ISSUE_KEY = /\bISS-\d+\b/u;
const DECISION_ID = /\bD-\d+\b/u;
const DEVIATION = "▲";
const LINE_NUMBER = /`[^`\n]*[\w/.-]\.\w+:\d+[^`\n]*`/u;
const DEFERRAL = /\b(?:TBD|TODO|FIXME|XXX|to be decided|to be determined|deferred|open question)\b/iu;
const ROW = new RegExp(TABLE_ROW_PATTERN, "u");
const SEPARATOR = new RegExp(TABLE_SEPARATOR_PATTERN, "u");

export const finding = (file, line, id, rule, fix) => ({ file, line, id, rule, fix });

const endsWith = (document, tail) => document.file === tail || document.file.endsWith(`/${tail}`);
const oneOf = (documents, tail) => documents.find((one) => endsWith(one, tail)) ?? null;

/** A clause's line, found by the identifier as it is written where the clause is defined: a heading
 *  carries it bare and a row or a criterion carries it in bold. */
const clauseLine = (text, id) => {
  const at = [`**${id}**`, id].map((form) => text.indexOf(form)).find((one) => one >= 0);
  return at === undefined ? 1 : lineAt(text, at);
};

const lineOf = (index, byFile, id) => {
  const clause = index.clauses.get(id);
  return clause ? clauseLine(byFile.get(clause.file) ?? "", id) : 1;
};

/** Every data row of every table a document holds: a separator opens one and the first line that is
 *  not a row closes it, so a row before any separator is prose that happens to hold pipes. */
export const dataRows = (text) => {
  const out = [];
  let seen = false;
  for (const [at, line] of String(text ?? "").split("\n").entries()) {
    if (SEPARATOR.test(line)) {
      seen = true;
      continue;
    }
    const found = ROW.exec(line);
    if (found && seen) out.push({ line: at + 1, cells: found[1].split("|").map((one) => one.trim()) });
    if (!found) seen = false;
  }
  return out;
};

/** The rules the tree's own index defines, so an `R-` nobody wrote is a finding rather than a
 *  reference the clause reader waves through as foreign. */
export const ruleIds = (documents) => {
  const rules = oneOf(documents, RULES_FILE);
  if (!rules) return new Set();
  return new Set(rules.text.split("\n").map((line) => RULE_ROW.exec(line)?.[1]).filter(Boolean));
};

/** Every file named for a requirement, kept per identifier rather than collapsed: two files of one
 *  number is the shape "exactly one" refuses, and a map keyed on the number would hide it. */
const requirementFiles = (documents) => {
  const out = new Map();
  for (const one of documents) {
    const number = REQUIREMENT_FILE.exec(one.file)?.[1];
    if (number) out.set(`FR-${number}`, [...(out.get(`FR-${number}`) ?? []), one.file]);
  }
  return out;
};

const fileProblem = (where, at) => {
  if (!where.length) {
    return "is a functional requirement with no srs/fr-NN-<slug>.md file of its own. One requirement "
      + "is one file, and one file is one capability";
  }
  if (where.length > 1) return `is carried by ${where.join(" and ")}, and a requirement has one file`;
  if (where[0] !== at) {
    return `is defined in ${at} and the file named for it is ${where[0]}. A requirement lives in the `
      + "file its number names, or a reader who found the file has not found the clause";
  }
  return null;
};

const sequence = (documents, index, byFile, files) => {
  const ids = [...index.clauses.values()].filter((one) => one.prefix === "FR").map((one) => one.id);
  const numbers = ids.map((one) => Number(one.slice(3))).sort((left, right) => left - right);
  const out = [];
  const at = oneOf(documents, INDEX_FILE);
  for (let want = 1; want <= (numbers.at(-1) ?? 0); want += 1) {
    if (numbers.includes(want)) continue;
    const missing = `FR-${String(want).padStart(2, "0")}`;
    out.push(finding(at?.file ?? INDEX_FILE, 1, missing, "R-01",
      `is missing from the functional-requirement sequence, which runs to FR-${numbers.at(-1)}. `
      + "Write the requirement, or renumber nothing and leave the run unbroken"));
  }
  for (const id of ids) {
    const at = index.clauses.get(id).file;
    const said = fileProblem(files.get(id) ?? [], at);
    if (said) out.push(finding(at, lineOf(index, byFile, id), id, "R-01", said));
  }
  return out;
};

const indexAgrees = (documents, files) => {
  const listed = oneOf(documents, INDEX_FILE);
  if (!listed) return [];
  const named = new Set([...identifiersIn(listed.text)].filter((one) => one.prefix === "FR").map((one) => one.id));
  const out = [];
  for (const id of named) {
    if (files.has(id)) continue;
    out.push(finding(listed.file, clauseLine(listed.text, id), id, "R-02",
      "is listed in the index and no srs/fr-NN-<slug>.md file carries it. Write the file, or take "
      + "the row out of the index"));
  }
  for (const [id, where] of files) {
    if (named.has(id)) continue;
    out.push(finding(where[0], 1, id, "R-02",
      `has a file and ${listed.file} does not list it. Add its row to the index, so the index and `
      + "the files say the same thing"));
  }
  return out;
};

const resolves = (documents, index, rules) => {
  const out = [];
  for (const { file, text } of documents) {
    const seen = new Set();
    for (const one of identifiersIn(text)) {
      if (seen.has(one.id)) continue;
      seen.add(one.id);
      const found = lookup(index, one.id);
      if (found.clause || found.ambiguous) continue;
      if (found.foreign && rules.has(one.id)) continue;
      out.push(finding(file, clauseLine(text, one.id), one.id, "R-03", found.foreign
        ? "is written as a rule of this tree and the tree's own index defines no such rule. "
          + "Cite the rule that exists, or write the row"
        : "names no clause of this tree. Cite the identifier that exists, or write the clause"));
    }
    for (const [at, line] of text.split("\n").entries()) {
      if (!LINE_NUMBER.test(line)) continue;
      out.push(finding(file, at + 1, LINE_NUMBER.exec(line)[0], "R-03",
        "cites a line number, which names nothing a week later. Name the clause by its identifier, "
        + "or the file without the line"));
    }
  }
  return out;
};

const deviations = (documents) => {
  const out = [];
  for (const { file, text } of documents) {
    for (const [at, line] of text.split("\n").entries()) {
      const said = withoutSpans(line);
      if (!said.includes(DEVIATION)) continue;
      if (ISSUE_KEY.test(said) || DECISION_ID.test(said)) continue;
      out.push(finding(file, at + 1, DEVIATION, "R-06",
        "marks a deviation and names neither an issue key nor a decision id. Name what settled it, "
        + "so a deviation is a decision somebody made and not a habit"));
    }
  }
  return out;
};

const openQuestions = (documents, index, byFile) => {
  const out = [];
  for (const clause of index.clauses.values()) {
    const found = DEFERRAL.exec(clause.text);
    if (!found) continue;
    out.push(finding(clause.file, lineOf(index, byFile, clause.id), clause.id, "R-07",
      `holds the deferral marker "${found[0]}". An open question is a tracker issue and a row of `
      + `${OPEN_ITEMS}, never a marker inside a clause`));
  }
  const items = oneOf(documents, OPEN_ITEMS);
  for (const row of items ? dataRows(items.text) : []) {
    if (ISSUE_KEY.test(row.cells.join(" "))) continue;
    out.push(finding(items.file, row.line, row.cells[0] ?? "", "R-07",
      "is an open item naming no issue. Name the issue that will settle it, so a question has an "
      + "owner and a place to be answered"));
  }
  return out;
};

const criteriaUnder = (documents, index, byFile) =>
  [...index.clauses.values()]
    .filter((one) => one.prefix === "UC" && !one.children.some((child) => child.startsWith("AC-")))
    .map((one) => finding(one.file, lineOf(index, byFile, one.id), one.id, "R-08",
      "is a use case with no acceptance criterion under it, so nothing about it can be proved by "
      + "running anything. Write the criterion, or drop the use case"));

const rulesEnforced = (index, byFile) =>
  [...index.clauses.values()]
    .filter((one) => one.prefix === "BR" && one.enforcedBy.length === 0)
    .map((one) => finding(one.file, lineOf(index, byFile, one.id), one.id, "R-09",
      `is a business rule no clause's Enforces field names, so nothing carries it out. Name it in `
      + `the requirement that enforces it, or take the row out of ${BUSINESS_RULES}`));

const oneHome = (index, byFile) =>
  [...index.duplicates].map(([id, files]) => {
    const where = [...new Set(files)];
    return finding(files[0], lineOf(index, byFile, id), id, "R-12", where.length > 1
      ? `is defined in ${where.join(" and ")}. An identifier is never reused: the second definition `
        + "becomes a reference to the first"
      : `is defined twice in ${where[0]}. An identifier is never reused and never renumbered`);
  });

/** Every rule of the tree that reads identifiers, in the order the tree's own index states them.
 *  `read` is `{ documents, index }` — the documents for the text, the index for the clauses. */
export const identifierProblems = ({ documents, index }) => {
  const byFile = new Map(documents.map((one) => [one.file, one.text]));
  const files = requirementFiles(documents);
  return [
    ...sequence(documents, index, byFile, files),
    ...indexAgrees(documents, files),
    ...resolves(documents, index, ruleIds(documents)),
    ...deviations(documents),
    ...openQuestions(documents, index, byFile),
    ...criteriaUnder(documents, index, byFile),
    ...rulesEnforced(index, byFile),
    ...oneHome(index, byFile),
  ];
};
