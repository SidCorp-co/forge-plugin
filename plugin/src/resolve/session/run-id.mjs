/* The id a run holds by standing in the tree it was given, kept in that tree's own git directory
   because every agent of a wave inherits one session id and the tree is the one thing each has to
   itself (ISS-467). The file's name is spelt here; the rest of the why: docs/cli/claim.md. */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join } from "node:path";

import { gitEntryAt } from "../../git/checkout-at.mjs";
import { CALLS_THE_WRITER, runsACommand, textOf } from "./granted-id.mjs";
import { withoutBodies } from "./here-doc.mjs";
import { NOWHERE, directoryAt, spans } from "../../hooks/shell-spans.mjs";

export const RUN_ID = "forge-run-id";
export const RUN_ID_VAR = "FORGE_SESSION_ID";

const answered = (read) => {
  try {
    return read();
  } catch {
    return null;
  }
};

export const gitDirAt = (from) => gitEntryAt(from)?.gitDir ?? null;

export const besideGit = (from, name) => {
  const dir = gitDirAt(from);
  return dir ? join(dir, name) : null;
};

const heldIn = (dir, name) => (dir ? (answered(() => readFileSync(join(dir, name), "utf8"))?.trim() || null) : null);

export const runIdAt = (from) => heldIn(gitDirAt(from), RUN_ID);

export const SCRATCH_AT = "forge-run-scratch";

export const SCRATCH = "forge-run-";

/* One tree and one id per batch, so the id carries the batch after its head rather than a second file beside it, which would be two places for one fact (ISS-1295). */
export const MINTED_FOR = /^(iss-\d+(?:\+\d+)*)-[0-9a-f]{8}$/u;

export const runsFor = (id) => {
  const named = MINTED_FOR.exec(String(id ?? "").trim())?.[1]?.toLowerCase();
  if (!named) return [];
  const [head, ...batch] = named.split("+");
  return [head, ...batch.map((one) => `iss-${one}`)];
};

export const runFor = (id) => runsFor(id)[0] ?? null;

/** The id a run holds, written beside the tree's git directory: the head's key, then each batchmate's number. The one writer of the form `MINTED_FOR` reads, called by the workspace start and by the brief a dispatch sends (ISS-1682). */
export const mintRunId = (path, keys) => {
  const [head, ...batch] = keys.map((one) => one.toLowerCase());
  const id = `${[head, ...batch.map((one) => one.slice(4))].join("+")}-${randomUUID().slice(0, 8)}`;
  const at = besideGit(path, RUN_ID);
  if (at) writeFileSync(at, `${id}\n`);
  return id;
};

/** The directory `start` made, off the record it wrote and never derived again: `start` prints that path as the run's
 *  own `TMPDIR`, so a run doing what it is told moves the root a second derivation reads. Null unless the record is absolute and named as this mints them; past that it is trusted — a forged record is a write to the git directory. */
export const scratchAt = (path) => {
  const dir = gitDirAt(path);
  const id = heldIn(dir, RUN_ID);
  const at = heldIn(dir, SCRATCH_AT);
  const named = Boolean(id) && MINTED_FOR.test(id) && basename(at ?? "") === `${SCRATCH}${id}`;
  return named && isAbsolute(at) ? at : null;
};

/** The directory a run writes in, under the temporary root and named for its id, and the record `scratchAt` reads. Both
 *  sides of a dispatch reach it, since a directory nothing records is one nothing can reap (ISS-2524). A record already naming this id's directory is kept as it is. The directory is made
 *  before the record, and a record that cannot be written takes the directory it was for with it, so neither stands
 *  without the other. `failed` is the reason where that happened, with `at` the directory it was for. */
export const scratchMinted = (path, id) => {
  const held = scratchAt(path);
  if (held && basename(held) === `${SCRATCH}${id}`) return { at: held, failed: null };
  const at = join(tmpdir(), `${SCRATCH}${id}`);
  const record = besideGit(path, SCRATCH_AT);
  if (!record) return { at, failed: "the tree has no git directory to record it in" };
  let made;
  try {
    made = mkdirSync(at, { recursive: true });
  } catch (error) {
    return { at, failed: error.message };
  }
  try {
    writeFileSync(record, `${at}\n`);
  } catch (error) {
    answered(() => rmSync(record, { force: true }));
    if (made) rmSync(made, { force: true, recursive: true });
    return { at, failed: error.message };
  }
  return { at, failed: null };
};

export const runNames = (id, key) => runsFor(id).includes(String(key ?? "").trim().toLowerCase());

/** The tree the write this event carries will stand in, which is not the one the hook stands in.
 *  `directoryAt` is the reading taken, the one with every move applied; two `forge` calls
 *  answering differently, or a text carrying an opener, name none. docs/cli/the-granted-id.md. */
export const runHeldWhere = (ev = null) => {
  const here = ev?.cwd || process.cwd();
  const text = withoutBodies(textOf(ev?.tool_input?.command));
  if (runsACommand(text)) return { id: null, at: here };
  const found = new Map();
  for (const { start, end } of spans(text, { pipes: true })) {
    if (!CALLS_THE_WRITER.test(text.slice(start, end))) continue;
    const at = directoryAt(text, start, here);
    if (at === NOWHERE) return { id: null, at: here };
    found.set(runIdAt(at), at);
  }
  if (!found.size) return { id: runIdAt(here), at: here };
  if (found.size > 1) return { id: null, at: here };
  const [[id, at]] = [...found];
  return { id, at };
};
