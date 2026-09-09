/* An index apart from the detail, both halves checked: a row whose file was renamed sends a reader
   nowhere, and a file no row names is a topic nobody is told exists (ISS-87). Capped by default and
   exempt by kind, so a document written later is in scope without anyone remembering it: the
   requirements tree answers to its own gate, and the journal a run appends to is read by date. */
import { LINK_TARGET_PATTERN, TABLE_SEPARATOR_PATTERN, withoutSpans } from "../markdown.mjs";
import { RECORDS_RATHER_THAN_INSTRUCTS } from "./doc-shape.mjs";

export const TOPIC_MAX = 9000;
/* An index has no length of its own, budgeted per part below; UC-12-6 of the tree says why not. */
export const INDEX = "docs/FORGE-CLI.md";
export const ROW_MAX = 300;
export const LEAD_MAX = 800;
const REQUIREMENTS = /^docs\/requirements\//u;
const uncapped = (rel) =>
  rel === INDEX || REQUIREMENTS.test(rel) || RECORDS_RATHER_THAN_INSTRUCTS.test(rel);

export const overCap = (docs, max = TOPIC_MAX) =>
  docs
    .filter(({ rel, chars }) => !uncapped(rel) && chars > max)
    .map(({ rel, chars }) => `${rel} is ${chars} characters, over the ${max} a topic is read in one`
      + " pass — split it and give each half its own index row. The cap is the round number above"
      + " docs/HOOKS.md, the one document this repository keeps whole");

const ROW = /^\|/u;
const LINK = new RegExp(LINK_TARGET_PATTERN, "u");
const SEPARATOR = new RegExp(TABLE_SEPARATOR_PATTERN, "u");
const CELLS = /^\|([^|]*)\|([^|]*)\|$/u;

/* Order and the header are checked, not just the counts: a table before the paragraph reads as an
   index and is not one, and a first row taken for a header on trust is a topic silently unchecked. */
export const indexProblems = ({ text, topics, path = "the index" }) => {
  const blocks = String(text ?? "").split(/\n{2,}/u).map((one) => one.trim()).filter(Boolean);
  const kindOf = (block) => {
    const lines = block.split("\n");
    if (lines.every((line) => ROW.test(line))) return "table";
    return block.startsWith("#") ? "heading" : "prose";
  };
  const kinds = blocks.map(kindOf);
  const out = [];
  if (kinds.join(" ") !== "heading prose table") {
    out.push(`${path} is ${kinds.join(", ") || "empty"} and an index is a heading, one paragraph`
      + " saying what the tree is for, and one table");
  }
  const lead = blocks.filter((block) => kindOf(block) !== "table").join("\n\n");
  if (lead.length > LEAD_MAX) {
    out.push(`${path} takes ${lead.length} characters before its table, over the ${LEAD_MAX} an`
      + " index's own heading and paragraph are read in — cut them back to what the tree is for."
      + " Splitting the index and shortening a row both buy nothing here: every other budget is one"
      + " row's, and the file itself is held to no length at all");
  }
  const rows = blocks.filter((block) => kindOf(block) === "table").flatMap((one) => one.split("\n"));
  const heads = CELLS.test(rows[0] ?? "") && !LINK.test(rows[0] ?? "") && SEPARATOR.test(rows[1] ?? "");
  if (rows.length && !heads) {
    out.push(`${path} opens its table with no two-column header and separator, so its first row`
      + " goes unread — the words of the header are yours, a link in it is a topic mistaken for one");
  }
  const named = [];
  for (const row of rows.slice(2)) {
    const target = LINK.exec(row)?.[1];
    if (row.length > ROW_MAX) {
      out.push(`${path} gives ${target ?? "a row"} a row of ${row.length} characters, over the`
        + ` ${ROW_MAX} one row is read in — tighten that row and no other. A row is the whole of an`
        + " index's budget, so the room the next topic has is this number whatever the rows already"
        + " here come to");
    }
    if (!CELLS.test(row)) out.push(`a row of ${path} is not a topic and a sentence: ${row.slice(0, 60)}`);
    else if (!target) out.push(`a row of ${path} links no file: ${row.slice(0, 60)}`);
    else if (!topics.includes(target)) out.push(`${path} links ${target}, which is not there`);
    else named.push(target);
  }
  for (const topic of topics) {
    const held = named.filter((one) => one === topic).length;
    if (held !== 1) out.push(`${topic} is named by ${held} row(s) of ${path} and wants exactly one`);
  }
  return out;
};

/* Where a document sends a reader: a `docs/…` inside a span is a quotation, not a topic named. */
const CITED_DOC = /\bdocs\/[\w./-]*\.md\b/gu;

export const docsCited = (text) =>
  [...new Set(withoutSpans(text).match(CITED_DOC) ?? [])].sort();
