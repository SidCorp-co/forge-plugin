/* One place decides what an edge kind means; a name compared elsewhere is a reader deciding again
   (ISS-769). GAP holds the two places a comment may sit, between an operator and its operand. */
import { lineAt } from "../../markdown.mjs";

export const TABLE = "plugin/src/tracker/edges/kinds.mjs";

export const INSTEAD = "Ask the kind's own row — `edgeRow(kind)`, `ordersEdge(edge)` or"
  + ` \`directedEdge(edge)\` from ${TABLE} — and where no column there answers the question, add the`
  + " column rather than the comparison.";

const NAMES = String.raw`RELATES|"blocks"|"relates"|'blocks'|'relates'`;
const GAP = String.raw`(?:\s|/\*[\s\S]*?\*/|//[^\n]*\n)*`;
const HELD = String.raw`\(*${GAP}(?:${NAMES})${GAP}\)*`;
const COMPARED = new RegExp(
  String.raw`(?:(?:===|!==)${GAP}${HELD}|${HELD}${GAP}(?:===|!==)|\bcase\s${GAP}${HELD}${GAP}:)`, "gu");

export const comparedIn = (text, where) =>
  [...String(text).matchAll(COMPARED)].map(({ index, 0: said }) =>
    ({ where, said: said.trim(), line: lineAt(text, index) }));

export const kindProblems = (found) =>
  found.filter((one) => one.where !== TABLE).map((one) =>
    `${one.where}:${one.line} decides what an edge kind means by comparing the name, \`${one.said}\`,`
    + ` and ${TABLE} is the one place that may. ${INSTEAD}`);
