/* The id a run holds by standing in the tree it was given, kept in that tree's own git directory
   because every agent of a wave inherits one session id and the tree is the one thing each has to
   itself (ISS-467). The file's name is spelt here; the rest of the why: docs/cli/claim.md. */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { checkoutAt } from "../../git/checkout-at.mjs";
import { CALLS_THE_WRITER, runsACommand } from "./granted-id.mjs";
import { NOWHERE, spans, standsIn } from "../../hooks/shell-spans.mjs";

export const RUN_ID = "forge-run-id";
export const RUN_ID_VAR = "FORGE_SESSION_ID";

const answered = (read) => {
  try {
    return read();
  } catch {
    return null;
  }
};

export const gitDirAt = (from) => checkoutAt(from)?.gitDir ?? null;

export const besideGit = (from, name) => {
  const dir = gitDirAt(from);
  return dir ? join(dir, name) : null;
};

export const heldBesideGit = (from, name) => {
  const at = besideGit(from, name);
  return at ? (answered(() => readFileSync(at, "utf8"))?.trim() || null) : null;
};

export const runIdAt = (from) => heldBesideGit(from, RUN_ID);

/* One tree and one id per batch, so the id carries the batch after its head rather than a second file beside it, which would be two places for one fact (ISS-1295). */
export const MINTED_FOR = /^(iss-\d+(?:\+\d+)*)-[0-9a-f]{8}$/u;

export const runsFor = (id) => {
  const named = MINTED_FOR.exec(String(id ?? "").trim())?.[1]?.toLowerCase();
  if (!named) return [];
  const [head, ...batch] = named.split("+");
  return [head, ...batch.map((one) => `iss-${one}`)];
};

export const runFor = (id) => runsFor(id)[0] ?? null;

export const runNames = (id, key) => runsFor(id).includes(String(key ?? "").trim().toLowerCase());

const textOf = (command) => (Array.isArray(command) ? command.join("\n") : String(command ?? ""));

/** The tree the write this event carries will stand in, which is not the one the hook stands in.
 *  `standsIn` puts the all-moves-applied reading first and that is the one taken; two `forge` calls
 *  answering differently, or a text carrying an opener, name none. docs/cli/the-granted-id.md. */
export const runHeldWhere = (ev = null) => {
  const here = ev?.cwd || process.cwd();
  const text = textOf(ev?.tool_input?.command);
  if (runsACommand(text)) return { id: null, at: here };
  const found = new Map();
  for (const { start, end } of spans(text, { pipes: true })) {
    if (!CALLS_THE_WRITER.test(text.slice(start, end))) continue;
    const [first] = standsIn(text, start);
    if (first === NOWHERE) return { id: null, at: here };
    const at = typeof first === "string" ? resolve(here, first) : here;
    found.set(runIdAt(at), at);
  }
  if (!found.size) return { id: runIdAt(here), at: here };
  if (found.size > 1) return { id: null, at: here };
  const [[id, at]] = [...found];
  return { id, at };
};
