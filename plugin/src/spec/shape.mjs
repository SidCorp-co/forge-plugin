/* The rules of the tree that are about a document's shape rather than its identifiers: the sections
   a kind of document carries, the question under a heading, the field line under a clause heading
   and the EARS sentence under a criterion. Each reads the document's own text, because the index
   keeps clauses and drops everything between them. The rules themselves are
   `docs/requirements/README.md`, and the section table there is read rather than copied. */
import { CODE_SPAN_NONEMPTY_PATTERN, withoutMarkup } from "../markdown.mjs";
/* The document grammar is `parse.mjs`'s: the five lines below are the same lines the parser reads,
   and a second declaration of one here is a selector that can drift on one side only (ISS-509). */
import { AC_ITEM as CRITERION, FIELD_LINE, HEADING, NAV, PROPOSAL } from "./parse.mjs";
import { RULES_FILE, finding, oneOf } from "./rules.mjs";

const SECTION_TABLE = /^\|\s*`([^`]+)`\s*\|(.+)\|\s*$/u;
const SPAN = new RegExp(`^\\s*${CODE_SPAN_NONEMPTY_PATTERN}`, "u");
const OPTIONAL = /\bwhere\b/u;
const SECTION = /^##\s+(.+)$/u;
const CLAUSE_HEADING = /\b(?:FR|UC|NFR|EI)-\d+(?:-\d+)*\b/u;
const LIST_ITEM = /^\s*[-*]\s/u;
const SENTENCE_BREAK = /(?<=\.)\s+(?=\S)/u;
const OPENERS = ["WHEN", "IF", "WHILE", "WHERE"];
const NEEDS_THEN = ["WHEN", "IF"];
const PLACEHOLDER = /<[^>]*>|N{2,}/gu;
const ESCAPED = /[.*+?^${}()|[\]\\]/gu;

/** The section list a row of the tree's own table declares, or `null` where the cell is prose. Every
 *  `·`-separated part has to open with a code span, so a cell naming a clause rather than a heading
 *  — `one clause per \`NFR-\` identifier` — declares nothing rather than a section called `NFR-`. */
export const sectionsIn = (cell) => {
  const parts = String(cell ?? "").split("·");
  const out = [];
  for (const part of parts) {
    const found = SPAN.exec(part);
    if (!found) return null;
    out.push({ name: found[1], optional: OPTIONAL.test(part.slice(found[0].length)) });
  }
  return out.length ? out : null;
};

/** The table of `docs/requirements/README.md`, one entry per row that declares headings: the file
 *  pattern as written and the sections it wants, in order. Takes that document, not the set. */
export const declaredSections = (rules) => {
  const out = [];
  for (const line of rules?.lines ?? String(rules?.text ?? "").split("\n")) {
    const row = SECTION_TABLE.exec(line);
    const sections = row && sectionsIn(row[2]);
    if (sections) out.push({ pattern: row[1], sections });
  }
  return out;
};

/** A row names its documents the way the tree writes a path: `<slug>` is a word the author picks
 *  and `NN` is the requirement's number. Both stand for one path segment's worth of text and neither
 *  may be read literally, or the row matches the one file nobody wrote. */
export const matches = (pattern, file) => {
  const source = pattern
    .split(PLACEHOLDER)
    .map((part) => part.replace(ESCAPED, "\\$&"))
    .join("[^/]+");
  return new RegExp(`(?:^|/)${source}$`, "u").test(file);
};

const headingsOf = (lines) =>
  lines.flatMap((line, at) => {
    const found = SECTION.exec(line);
    return found ? [{ name: withoutMarkup(found[1]).trim(), line: at + 1 }] : [];
  });

const sectionProblems = (document, sections) => {
  const declared = sections.map((one) => one.name);
  const found = headingsOf(document.lines).filter((one) => declared.includes(one.name));
  const out = [];
  let at = 0;
  for (const want of sections) {
    const seen = found.findIndex((one, index) => index >= at && one.name === want.name);
    if (seen < 0) {
      if (!want.optional) {
        out.push(finding(document.file, 1, `## ${want.name}`, "R-13",
          "is a section this kind of document carries and this file has not got, or has out of "
          + "order. The order is the one the section table in docs/requirements/README.md states"));
      }
      continue;
    }
    at = seen + 1;
  }
  return out;
};

const sections = (documents) => {
  const declared = declaredSections(oneOf(documents, RULES_FILE));
  return documents.flatMap((document) => {
    const want = declared.find((one) => matches(one.pattern, document.file));
    return want ? sectionProblems(document, want.sections) : [];
  });
};

const nextText = (lines, from) => {
  let at = from;
  while (at < lines.length && (!lines[at].trim() || NAV.test(lines[at]))) at += 1;
  if (at < lines.length && PROPOSAL.test(lines[at])) {
    while (at < lines.length && lines[at].trim()) at += 1;
    while (at < lines.length && (!lines[at].trim() || NAV.test(lines[at]))) at += 1;
  }
  return at < lines.length ? lines[at].trim() : "";
};

const questions = (documents) =>
  documents.flatMap(({ file, lines }) =>
    lines.flatMap((line, at) => {
      const found = SECTION.exec(line);
      if (!found || withoutMarkup(nextText(lines, at + 1)).trim().endsWith("?")) return [];
      return [finding(file, at + 1, `## ${withoutMarkup(found[1]).trim()}`, "R-14",
        "is a section heading with no question under it. Write the question this section answers "
        + "on the line below it, so a reader knows what they came here for")];
    }));

const fieldLines = (documents) =>
  documents.flatMap(({ file, lines }) =>
    lines.flatMap((line, at) => {
      const found = HEADING.exec(line);
      if (!found || !CLAUSE_HEADING.test(found[2])) return [];
      if (FIELD_LINE.test(nextText(lines, at + 1))) return [];
      return [finding(file, at + 1, CLAUSE_HEADING.exec(found[2])[0], "R-15",
        "is a clause heading whose first non-blank line does not open with `Rev:`. A clause carries "
        + "its machinery on a line of its own beside it, and a clause with no revision cannot be cited")];
    }));

/** The lines a criterion's body holds: everything under its field line until the next list item, the
 *  next heading or the next unindented line. Blank lines are inside it, because the clause reader
 *  closes a criterion at the first of them and a second sentence a paragraph below would otherwise
 *  reach this rule as one. */
export const criterionBody = (lines, from) => {
  const held = [];
  for (let at = from; at < lines.length; at += 1) {
    const line = lines[at];
    if (!line.trim()) {
      held.push("");
      continue;
    }
    if (LIST_ITEM.test(line) || HEADING.test(line) || !/^\s/u.test(line)) break;
    held.push(line.trim());
  }
  return held.join(" ").trim();
};

const earsProblem = (said) => {
  const parts = said.split(SENTENCE_BREAK).filter(Boolean);
  if (!parts.length) {
    return "carries no sentence under its field line, so nothing about it can be judged. Write the "
      + "EARS sentence: WHEN, IF, WHILE or WHERE, with SHALL, and THEN after WHEN or IF";
  }
  if (parts.length > 1) {
    return `carries ${parts.length} sentences under its field line, and one criterion is one `
      + "behaviour. Split it into one criterion per outcome";
  }
  const opener = OPENERS.find((one) => parts[0].startsWith(`${one} `));
  if (!opener) return "opens with none of WHEN, IF, WHILE or WHERE, so it is not in EARS form";
  if (!parts[0].includes("SHALL")) return `opens with ${opener} and holds no SHALL, so it obliges nothing`;
  if (NEEDS_THEN.includes(opener) && !parts[0].includes("THEN")) {
    return `opens with ${opener} and holds no THEN, so the event and the response are not told apart`;
  }
  return null;
};

/* A criterion is a list item, so its field line is the rest of its own first line and R-15 has to
   read it here: `fieldLines` above selects headings, and a criterion has none to select. */
const criterionProblems = (lines, at, found) => {
  const out = [];
  if (!FIELD_LINE.test(found[2].trim())) {
    out.push({ rule: "R-15", said: "is an acceptance criterion whose own first line does not carry "
      + "`Rev:`. A criterion is a list item, so its field line is the rest of that line" });
  }
  const said = earsProblem(withoutMarkup(criterionBody(lines, at + 1)).replace(/\s+/gu, " ").trim());
  if (said) out.push({ rule: "R-11", said });
  return out;
};

const criteria = (documents) =>
  documents.flatMap(({ file, lines }) =>
    lines.flatMap((line, at) => {
      const found = CRITERION.exec(line);
      if (!found) return [];
      return criterionProblems(lines, at, found)
        .map((one) => finding(file, at + 1, found[1], one.rule, one.said));
    }));

/** Every rule of the tree that reads a document's shape. `documents` is `{ file, text }`; each is
 *  split into lines once here, since all four readings below want the same lines of the same file. */
export const shapeProblems = (documents) => {
  const read = documents.map((one) => ({ ...one, lines: String(one.text ?? "").split("\n") }));
  return [
    ...criteria(read),
    ...sections(read),
    ...questions(read),
    ...fieldLines(read),
  ];
};
