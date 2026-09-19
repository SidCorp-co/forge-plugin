/* What became of each top-level case a run reached, by name: an exit status says some case failed
   and never which, and a skip, a todo and a failure node names no kind for are each something other
   than a case judged. The roster ends with node's own count of the file's top-level cases, reported
   only where the file ran to its end: short of that, a roster missing a case says a name is unique. */
import { readFileSync } from "node:fs";

import { isFile } from "./isolation.mjs";

const outcomeOf = (type, data) => {
  if (data.todo) return "todo";
  if (data.skip) return "skip";
  if (type !== "test:fail") return "pass";
  return data.details?.error?.failureType ? "fail" : "cancelled";
};

export default async function* counted(source) {
  let topLevel = null;
  for await (const { type, data } of source) {
    if (type === "test:summary" && data.file) topLevel = data.counts.topLevel;
    if (type !== "test:pass" && type !== "test:fail") continue;
    if (data.nesting !== 0 || isFile(data)) continue;
    yield `${JSON.stringify({ name: data.name, outcome: outcomeOf(type, data) })}\n`;
  }
  yield `${JSON.stringify({ topLevel })}\n`;
}

export const resultsFrom = (at) => {
  let lines;
  try {
    lines = readFileSync(at, "utf8").split("\n").filter(Boolean).map((one) => JSON.parse(one));
  } catch {
    return null;
  }
  const rows = lines.slice(0, -1);
  if (lines.at(-1)?.topLevel !== rows.length) return null;
  return rows.every((one) => typeof one?.name === "string" && typeof one?.outcome === "string") ? rows : null;
};
