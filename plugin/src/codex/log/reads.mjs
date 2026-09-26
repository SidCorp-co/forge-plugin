/* How many whole-set reads an issue's run has taken, at which heads, and which of them re-read a head
   already read: derived from the consult log alone, so a crashed run leaves nothing wrong behind it
   and there is no second tally to keep. Counted and never refused (ISS-1090). docs/cli/codex-the-log.md. */
import { isAbsolute } from "node:path";

import { bodied, inRepo, isAnswered } from "../codex-log.mjs";
import { REVIEW_READS, RUNGS, readsAllowed } from "../../ladder.mjs";

export const FIRST = "first";
export const RECHECK = "recheck";
export const REPEAT = "repeat";
export const PASS = "pass";

/* The files of the checkout a row carried whole. A path outside it is a plan or a criteria payload,
   which a whole-set read may carry beside the set and never is one alone. */
const carriedWhole = (one) => {
  const sent = new Map((one.sent ?? []).map((part) => [part.rel, part]));
  return (one.files ?? []).filter((rel) => !isAbsolute(rel) && bodied(sent.get(rel)));
};

/** A consult that read files of this checkout whole at a clean recorded head, and is not a `--recheck`, which verifies findings rather than reading the set. */
export const isWholeRead = (one) => isAnswered(one) && one.send === "bodies" && !one.dirty
  && Boolean(one.head) && !one.recheck && carriedWhole(one).length > 0;

/* A further pass is one run's, as AC-06-1-9 has it and the landing reads it: two runs reading halves of a set at one head each took a read, and folding one into the other would undercount both. */
const continues = (held, one, files) =>
  Boolean(held?.run) && one.run === held.run && !files.some((rel) => held.files.has(rel));

/** Each whole-set read among rows already in log order, one entry per row: the first; a recheck, at a head no earlier read was at; a repeat, at a head already read, which with a head recorded per commit means no commit between; or a further pass of the read at that head by the same run, carrying only files it had not read (AC-06-1-9). `read` is the ordinal of the read the row belongs to. */
export const classified = (rows) => {
  const atHead = new Map();
  const out = [];
  let reads = 0;
  for (const one of rows) {
    if (!isWholeRead(one)) continue;
    const files = carriedWhole(one);
    const held = atHead.get(one.head);
    if (continues(held, one, files)) {
      for (const rel of files) held.files.add(rel);
      held.passes += 1;
      out.push({ row: one, kind: PASS, read: held.read, passes: held.passes });
      continue;
    }
    reads += 1;
    const kind = held ? REPEAT : (reads === 1 ? FIRST : RECHECK);
    atHead.set(one.head, { files: new Set(files), read: reads, passes: 1, run: one.run ?? null });
    out.push({ row: one, kind, read: reads, passes: 1 });
  }
  return out;
};

/** The reads themselves, a further pass folded into the read it continues. */
export const readsIn = (rows) => {
  const reads = [];
  for (const one of classified(rows)) {
    if (one.kind === PASS) reads[one.read - 1].passes = one.passes;
    else reads.push({ head: one.row.head, kind: one.kind, passes: 1 });
  }
  return reads;
};

const upper = (key) => String(key).toUpperCase();

/** An issue's rows: the answered consults of this repository naming one of its keys, or written under the run given. */
export const rowsOf = (entries, { keys = [], run = null, here }) => {
  const named = new Set(keys.map(upper));
  return entries.filter((one) => isAnswered(one) && inRepo(one, here)
    && ((one.issues ?? []).some((key) => named.has(upper(key))) || (run !== null && one.run === run)));
};

const runKey = (one) => (one.run ? `run ${one.run}` : `row ${one.id ?? one.at}`);

/** The window's figure for `forge codex stats`: each run's rows read as one sequence over the history given, so a read whose first fell before the window is still a repeat or a pass inside it, and only the window's rows are counted. A row naming no run stands alone, nothing tying it to any other. */
export const readFigures = (rows, history = rows) => {
  const inWindow = new Set(rows);
  const wanted = new Set(rows.map(runKey));
  const byRun = new Map();
  for (const one of history) {
    const key = runKey(one);
    if (wanted.has(key)) byRun.set(key, [...(byRun.get(key) ?? []), one]);
  }
  const held = { reads: 0, rechecks: 0, repeats: 0, runs: 0 };
  for (const group of byRun.values()) {
    const reads = classified(group).filter((one) => inWindow.has(one.row) && one.kind !== PASS);
    if (!reads.length) continue;
    held.runs += 1;
    held.reads += reads.length;
    held.rechecks += reads.filter((one) => one.kind === RECHECK).length;
    held.repeats += reads.filter((one) => one.kind === REPEAT).length;
  }
  return held;
};

const WHY = {
  [FIRST]: "first",
  [RECHECK]: "recheck — the head moved since the read before it",
  [REPEAT]: "repeat — this head was already read, with no commit between",
};

const passesSaid = (passes) => (passes > 1 ? `, in ${passes} passes` : "");

const allowanceSaid = (rung) => {
  const allowed = readsAllowed(rung);
  return allowed === null ? `a \`${rung}\` states no allowance` : `the ${allowed} a \`${rung}\` allows`;
};

/** What `forge advance --owed` prints: the count beside the rung's allowance, then each read's head and class. */
export const readsSaid = (reads, { ref, rung }) => {
  const allowed = readsAllowed(rung);
  const opened = `Whole-set reads of ${ref} in this repository, off the consult log: `;
  if (!reads.length) return `${opened}none yet, and ${allowanceSaid(rung)}.`;
  const over = allowed !== null && reads.length > allowed ? " That is past the allowance, and nothing refuses it." : "";
  return [
    `${opened}${reads.length}, and ${allowanceSaid(rung)}.${over}`,
    ...reads.map((one) => `  ${one.head}  ${WHY[one.kind]}${passesSaid(one.passes)}`),
  ].join("\n");
};

/* Per rung and not this issue's, so a consult never has to reach the tracker to say it. */
const perRung = () => {
  const lighter = RUNGS.filter((rung) => readsAllowed(rung) !== null);
  const rest = RUNGS.filter((rung) => readsAllowed(rung) === null);
  return `a ${lighter.join(" or a ")} allows ${REVIEW_READS} and a ${rest.join(" or a ")} states none`;
};

const whoseSaid = (keys, run) => [...(keys.length ? [keys.join(", ")] : []), ...(run ? ["this run"] : [])].join(" and ");

const placeSaid = ({ kind, read, passes, row }) => (kind === PASS
  ? `a further pass of whole-set read ${read} at ${row.head}, pass ${passes}, carrying only files that read had not`
  : `whole-set read ${read}, at ${row.head} — ${WHY[kind]}`);

/** The line a consult ends on once it has read whole: which read it was, of whose, and the allowance per rung. Null where it read nothing whole or belongs to nobody. */
export const placeLine = (entries, row, { keys = [], run = null, here }) => {
  if (!isWholeRead(row) || (!keys.length && run === null)) return null;
  const place = classified(rowsOf([...entries, row], { keys, run, here })).at(-1);
  if (place?.row !== row) return null;
  const owed = keys.length ? ` \`forge advance ${keys[0]} --owed\` counts them against its rung.` : "";
  return `codex: ${placeSaid(place)}, of ${whoseSaid(keys, run)}; ${perRung()}.${owed}`;
};
