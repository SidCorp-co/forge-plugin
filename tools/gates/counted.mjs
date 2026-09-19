/* What became of each top-level case a run reached, by name: an exit status says some case failed
   and never which, a skip, a todo and a failure node names no kind for are each something other
   than a case judged, and a roster is a reading only where the count it ends with is the number of
   rows above it — a record cut short would otherwise establish that a name is carried once. */
import { readFileSync } from "node:fs";

import { isFile } from "./isolation.mjs";

const outcomeOf = (type, data) => {
  if (data.todo) return "todo";
  if (data.skip) return "skip";
  if (type !== "test:fail") return "pass";
  return data.details?.error?.failureType ? "fail" : "cancelled";
};

export default async function* counted(source) {
  let rows = 0;
  for await (const { type, data } of source) {
    if (type !== "test:pass" && type !== "test:fail") continue;
    if (data.nesting !== 0 || isFile(data)) continue;
    rows += 1;
    yield `${JSON.stringify({ name: data.name, outcome: outcomeOf(type, data) })}\n`;
  }
  yield `${JSON.stringify({ rows })}\n`;
}

export const resultsFrom = (at) => {
  let lines;
  try {
    lines = readFileSync(at, "utf8").split("\n").filter(Boolean).map((one) => JSON.parse(one));
  } catch {
    return null;
  }
  const rows = lines.slice(0, -1);
  if (lines.at(-1)?.rows !== rows.length) return null;
  return rows.every((one) => typeof one?.name === "string" && typeof one?.outcome === "string") ? rows : null;
};
