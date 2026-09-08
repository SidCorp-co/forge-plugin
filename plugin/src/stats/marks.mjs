/* The readings both harness evals write at a mark and read back as a pinned before window: one store, kept as the
   consult log keeps its entries. A runs reading carries the root whose corpus was counted; a consult reading is the device's and carries none. docs/cli/stats-the-eval.md. */
import { join } from "node:path";

import { appendJsonl, jsonlAt } from "../hooks/hook-log-file.mjs";
import { configDir } from "../resolve/config.mjs";
import { fail } from "../resolve/settings.mjs";

export const RUNS = "runs";
export const CONSULTS = "consults";

export const marksPath = () => join(configDir("forge"), "eval-marks.jsonl");

const readAll = () => jsonlAt(marksPath());

export const marksOf = (kind, root = null) =>
  readAll().filter((one) => one.kind === kind && (root === null || one.root === root));

const sameMark = (held, record) =>
  held.kind === record.kind && held.mark === record.mark && (held.root ?? null) === (record.root ?? null);

export const WRITTEN = "written";
export const HELD = "held";
export const FAILED = "failed";

/** Appends unless the same kind, mark and root is held, and says which — written, held or failed. A failed write is said and carried past, as the consult log's is: the mark line it accompanies is worth more than a stats file.
 *  No two writers race here: a runs mark is written under the ship's lock, and a consult crossing belongs to exactly the record that landed on it. */
export const writeMark = (record) => {
  try {
    if (readAll().some((one) => sameMark(one, record))) return HELD;
    appendJsonl(marksPath(), record, configDir("forge"));
    return WRITTEN;
  } catch (error) {
    console.error(`stats: could not write ${marksPath()} (${error.message}); this reading is not held.`);
    return FAILED;
  }
};

export const wroteSaid = (outcome, mark, verb) => ({
  [WRITTEN]: `The reading is held as mark ${mark} (\`${verb} --against ${mark}\`).`,
  [HELD]: `Mark ${mark} was already held, so nothing was written.`,
  [FAILED]: `The reading could not be written, so mark ${mark} is not held.`,
}[outcome]);

/* Pulled out before `flags`, which cannot read a flag standing alone: alone is `null`, the newest. */
export const againstIn = (argv, verb) => {
  const at = argv.indexOf("--against");
  if (at < 0) return { against: undefined, rest: argv };
  const next = argv[at + 1];
  if (next === undefined || next.startsWith("--")) return { against: null, rest: argv.filter((one, n) => n !== at) };
  const mark = Number(next);
  if (!Number.isInteger(mark) || mark < 1) fail(`${verb}: --against takes a mark — the count the mark line printed — not \`${next}\`.`);
  return { against: mark, rest: argv.filter((one, n) => n !== at && n !== at + 1) };
};

/** The reading `--against` names, or the newest of the scope; refused by name, with the list subject. */
export const resolveAgainst = (kind, asked, { root = null, verb, list, writes }) => {
  const held = marksOf(kind, root);
  const scope = kind === RUNS ? "for this project" : "on this device";
  if (asked === null) {
    if (held.length) return held.at(-1);
    fail(`${verb}: --against names no reading — none is held ${scope} yet; ${writes}. \`${list}\` lists what is held.`);
  }
  const found = held.findLast((one) => one.mark === asked);
  if (found) return found;
  fail(`${verb}: no ${kind} reading at mark ${asked} ${scope}. \`${list}\` lists what is held.`);
  return null;
};

const WHEN = 16;
const stamped = (iso) => iso.slice(0, 16).replace("T", " ");

/** The `--against` line both evals print, and the one sentence saying the two windows meet. The count is each eval's own unit and the span its own reading; the wording and the two spaces are neither, and a case pinning them could otherwise drift in one harness alone. */
export const heldAtMark = (count, mark, span, overlapping) =>
  `the ${count} held at mark ${mark}  ${span}`
  + (overlapping ? "  — overlapping the recent window, which begins before this one ends" : "");

/** One line per reading, newest first; `describe` says the recent window's size and bounds in its kind's units. */
export const markLines = (records, describe) =>
  [...records].reverse().map((one) => `mark ${String(one.mark).padStart(5)}  ${stamped(one.at).padEnd(WHEN)}  ${describe(one)}`);
