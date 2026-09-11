/* The id a run holds by standing in the tree it was given, kept in that tree's own git directory
   because every agent of a wave inherits one session id and the tree is the one thing each has to
   itself (ISS-467). The file's name is spelt here; the rest of the why: docs/cli/claim.md. */
import { readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { CALLS_THE_WRITER, runsACommand } from "./granted-id.mjs";
import { NOWHERE, spans, standsIn } from "../../hooks/shell-spans.mjs";

export const RUN_ID = "forge-run-id";
export const RUN_ID_VAR = "FORGE_SESSION_ID";

const GITDIR = /^gitdir:\s*(\S.*)$/mu;

const answered = (read) => {
  try {
    return read();
  } catch {
    return null;
  }
};

/** Off the disk and never spawned: a gate has a deadline and `git rev-parse` is a process. Started
 *  at the physical path: a symlink into another repository ascends into the one it was spelt under. */
export const gitDirAt = (from) => {
  const start = answered(() => realpathSync(resolve(from ?? ".")));
  if (!start) return null;
  for (let at = start; ; at = dirname(at)) {
    const dot = join(at, ".git");
    const kind = answered(() => statSync(dot));
    if (kind?.isDirectory()) return dot;
    if (kind?.isFile()) {
      const named = GITDIR.exec(answered(() => readFileSync(dot, "utf8")) ?? "")?.[1]?.trim();
      return named ? (isAbsolute(named) ? named : resolve(at, named)) : null;
    }
    if (dirname(at) === at) return null;
  }
};

export const besideGit = (from, name) => {
  const dir = gitDirAt(from);
  return dir ? join(dir, name) : null;
};

export const heldBesideGit = (from, name) => {
  const at = besideGit(from, name);
  return at ? (answered(() => readFileSync(at, "utf8"))?.trim() || null) : null;
};

export const runIdAt = (from) => heldBesideGit(from, RUN_ID);

export const MINTED_FOR = /^(iss-\d+)-[0-9a-f]{8}$/iu;

export const runFor = (id) => MINTED_FOR.exec(String(id ?? "").trim())?.[1]?.toLowerCase() ?? null;

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
