/* One place decides what an edge kind means, and a name compared anywhere else is a reader deciding
   for itself again (ISS-769). The message below is the whole rule; the cases that fire it are the test. */
import { lineAt } from "../../markdown.mjs";

export const TABLE = "plugin/src/tracker/edges/kinds.mjs";

export const INSTEAD = "Ask the kind's own row — `edgeRow(kind)`, `ordersEdge(edge)` or"
  + ` \`directedEdge(edge)\` from ${TABLE} — and where no column there answers the question, add the`
  + " column rather than the comparison.";

const NAMES = String.raw`RELATES|"blocks"|"relates"|'blocks'|'relates'`;
const HELD = String.raw`\(*\s*(?:${NAMES})\s*\)*`;
const COMPARED = new RegExp(
  String.raw`(?:(?:===|!==)\s*${HELD}|${HELD}\s*(?:===|!==)|\bcase\s+${HELD}\s*:)`, "gu");

export const comparedIn = (text, where) =>
  [...String(text).matchAll(COMPARED)].map(({ index, 0: said }) =>
    ({ where, said: said.trim(), line: lineAt(text, index) }));

export const kindProblems = (found) =>
  found.filter((one) => one.where !== TABLE).map((one) =>
    `${one.where}:${one.line} decides what an edge kind means by comparing the name, \`${one.said}\`,`
    + ` and ${TABLE} is the one place that may. ${INSTEAD}`);
