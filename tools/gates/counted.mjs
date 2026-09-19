/* What became of each top-level case a run reached, by name: an exit status says some case failed
   and never which, a skip or a todo is a pass carrying a flag rather than a result, and a record
   that will not parse whole is a roster missing cases nobody could then name. */
import { readFileSync } from "node:fs";

import { isFile } from "./isolation.mjs";

const outcomeOf = (type, data) => {
  if (type === "test:fail") return "fail";
  if (data.todo) return "todo";
  if (data.skip) return "skip";
  return "pass";
};

export default async function* counted(source) {
  for await (const { type, data } of source) {
    if (type !== "test:pass" && type !== "test:fail") continue;
    if (data.nesting !== 0 || isFile(data)) continue;
    yield `${JSON.stringify({ name: data.name, outcome: outcomeOf(type, data) })}\n`;
  }
}

export const resultsFrom = (at) => {
  let rows;
  try {
    rows = readFileSync(at, "utf8").split("\n").filter(Boolean).map((one) => JSON.parse(one));
  } catch {
    return null;
  }
  const whole = rows.every((one) => typeof one?.name === "string" && typeof one?.outcome === "string");
  return whole ? rows : null;
};
