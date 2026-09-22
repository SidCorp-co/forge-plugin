/* The readings both harness evals write at a mark and read back as a pinned before window: one store, kept as the
   consult log keeps its entries. What a project reading is held under is `scopeOf` below; a consult
   reading is the device's and is held under nothing. docs/cli/stats-the-mark.md. */
import { join } from "node:path";

import { copyFileSync, existsSync, renameSync, writeFileSync } from "node:fs";

import { appendJsonl, jsonlAt, jsonlBack, jsonlBytes, jsonlMark } from "../../hooks/log/hook-log-file.mjs";
import { configDir } from "../../resolve/config.mjs";
import { UNKNOWN_DEVICE } from "../../resolve/device.mjs";
import { underLock } from "../../resolve/file-lock.mjs";
import { checkoutAt } from "../../git/checkout-at.mjs";
import { fail, projectAt } from "../../resolve/settings.mjs";

export const RUNS = "runs";
export const CONSULTS = "consults";
/* A kind of its own, so a count mark and the release that landed at that count never compete. */
export const RELEASES = "releases";
/* What a change said it would move, written before that change lands and keyed to the issue that made it. */
export const CLAIMS = "claims";

export const marksPath = () => join(configDir("forge"), "eval-marks.jsonl");

/* Beside the store and never of this run's own: two processes crossing the same window is the case
   this guards, so a lock either process could miss guards nothing. */
const lockPath = () => `${marksPath()}.lock`;
/* What says the migration has run. The store itself cannot answer it: a record left unassigned is
   indistinguishable from one not yet reached, so asking the records would migrate for ever. */
const migratedPath = () => `${marksPath()}.migrated`;
/* The store as it stood, written before a byte of it is rewritten, and the whole of the way back. */
const beforePath = () => `${marksPath()}.before-ISS-1984`;

/* A checkout the tracker names no project for. Under a prefix no tracker slug can wear, because the
   answer has to be a value and never `null`: `null` is what the consult side passes to mean every
   reading on this device, and an unidentified project read that way would be handed the readings of
   projects that are not it. One bucket for every such checkout would do the same thing a size
   smaller, so the repository is what separates them. */
const NO_PROJECT = "checkout:";

/** The scope a reading is held under: the project the tracker names for the checkout whose corpus was
 *  read, or the repository that checkout belongs to where it names none. Either way it keys on the
 *  repository rather than on the directory, so a checkout and every linked worktree of it answer
 *  alike and no temporary directory reaches it — which the key it replaces, `rootFor(directory)`,
 *  could not say, being `join(tmpdir(), slug(checkout))` and so a different value in every run that
 *  was handed a TMPDIR of its own (ISS-1984). */
export const scopeOf = (directory) => {
  const named = projectAt(directory);
  if (named) return named;
  const repository = checkoutAt(directory)?.repository ?? null;
  /* The repository where there is one and the directory itself where there is not: both are stable
     across the temporary directories a run is handed, which is the whole of what the old key was
     not. The WHOLE path and never its last segment — `/work/a/app` and `/work/b/app` are two
     repositories, and a key that could not tell them apart would resolve one's readings for the
     other, which is the defect this scope exists to end (consult 6f21 F3). */
  return `${NO_PROJECT}${repository ?? directory}`;
};

const readAll = () => jsonlAt(marksPath());

/** The readings of one kind, oldest first, for one scope — or for every scope where none is named,
 *  which is what a consult reading is held under. Only the records carrying that scope are parsed:
 *  the store is a file every reading ever taken is appended to, and parsing all of it to answer for
 *  one project is what made every reading pay for every reading (ISS-1984). */
const scanOf = (kind, scope) => {
  const every = scope === null ? [] : [jsonlMark("scope", scope)];
  return [...jsonlBack(jsonlBytes(marksPath()), [jsonlMark("kind", kind)], every)].reverse();
};

export const marksOf = (kind, scope = null) => {
  migrated();
  return scanOf(kind, scope);
};

/* One rewrite and never a second. Every record is written back keeping every field it holds and
   gaining only the scope `scopeHeld` works out for it. */
/* What a record already held is owed. Its OWN recorded checkout and never the one this process is
   standing in: `root` is a scratch path, and decoding a project out of one would be a guess wearing a
   reading's clothes. A record naming no checkout at all keeps its figures under no scope and is
   reported, there being nothing about it to resolve. */
const scopeHeld = (one) => (one.project ? scopeOf(one.project) : null);

const migrateHeld = () => {
  if (existsSync(migratedPath())) return;
  const held = readAll();
  const left = [];
  if (held.length) {
    /* Once, and never over a backup already published: a rewrite interrupted after the store was
       renamed leaves the next attempt reading records already migrated, and copying THOSE over the
       way back would destroy the very bytes it exists to hold. Copied aside and renamed into place,
       so a copy interrupted half way is not mistaken for a finished one. */
    if (!existsSync(beforePath())) {
      const aside = `${beforePath()}.part`;
      copyFileSync(marksPath(), aside);
      renameSync(aside, beforePath());
    }
    const lines = held.map((one) => {
      if (one.kind === CONSULTS) return JSON.stringify(one);
      const scope = scopeHeld(one);
      if (!scope) left.push(one.project ?? one.root ?? "a record naming no checkout");
      /* Said rather than left absent, and never worked out from what this machine is configured as
         now: a reading taken before either field existed was taken on a device nothing recorded and
         under a contract nothing wrote down, and stamping today's answer onto it would make a
         reading from a month ago claim to have been measured under this week's rules. */
      return JSON.stringify({ ...one, ...(scope ? { scope } : {}),
        device: one.device ?? UNKNOWN_DEVICE, contract: one.contract ?? null });
    });
    const next = `${marksPath()}.next`;
    writeFileSync(next, `${lines.join("\n")}\n`, { mode: 0o600 });
    /* Renamed rather than written over: a rewrite interrupted half way would leave the store torn,
       and the copy beside it is the way back only if the store it answers for is whole. */
    renameSync(next, marksPath());
  }
  writeFileSync(migratedPath(), `${JSON.stringify({
    at: new Date().toISOString(), records: held.length, unresolved: left.length,
    checkouts: [...new Set(left)], kept: held.length ? beforePath() : null,
  })}\n`, { mode: 0o600 });
};

/* Outside the lock where the marker already answers, since that is every call but the first one this
   machine ever makes, and the lock is what two crossing writers are queued by and not what a read is. */
/* Strict, so a writer that could not take the lock says the reading is not held rather than writing
   beside another one; and a stale window that covers a whole-file rewrite, because the guarded work
   here is the migration of every record the store holds and a holder taken for gone at five seconds
   would be evicted in the middle of it. */
const GUARDED = { strict: true, stale: 120_000, waits: 30_000 };

const migrated = () => {
  if (existsSync(migratedPath())) return;
  try {
    underLock(lockPath(), migrateHeld, GUARDED);
  } catch {
    /* A store this machine cannot write is one it cannot migrate either. The read goes on over
       whatever is there rather than throwing, as `jsonlAt` answers an unreadable store with none,
       and the write beside it is what says the reading could not be held. */
  }
};

/* A release is one version and not one count: two can land at the same count, and holding them by count discards the second and leaves the version nothing to resolve. */
const identityOf = (record) => {
  if (record.kind === RELEASES) return record.version ?? null;
  /* A claim is one issue's latest word and two claims about one issue are two records, so its identity
     carries the moment: holding them by issue alone would make a revised claim a no-op write. */
  if (record.kind === CLAIMS) return `${record.issue}@${record.at}`;
  return record.mark;
};

const sameMark = (held, record) =>
  held.kind === record.kind && identityOf(held) === identityOf(record) && (held.scope ?? null) === (record.scope ?? null);

export const WRITTEN = "written";
export const HELD = "held";
export const FAILED = "failed";

/** Appends unless the same reading is held, and says which — written, held or failed. A failed write is said and carried past, as the consult log's is: the mark line it accompanies is worth more than a stats file. The check and the append are one act under the store's own lock: the eval writes a reading as well as the ship now, so two processes crossing one window would otherwise both read no reading and both append one, and a record of this size is far past the bytes a single append is atomic in. */
export const writeMark = (record) => {
  try {
    return underLock(lockPath(), () => {
      migrateHeld();
      if (scanOf(record.kind, record.scope ?? null).some((one) => sameMark(one, record))) return HELD;
      appendJsonl(marksPath(), record, configDir("forge"));
      return WRITTEN;
    }, GUARDED);
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

/** The same three outcomes said in a release's own identity, a count being none of it. */
export const releaseSaid = (outcome, version) => ({
  [WRITTEN]: "The reading is held at that version.",
  [HELD]: `Version ${version} was already held, so nothing was written.`,
  [FAILED]: `The reading could not be written, so ${version} holds none.`,
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

/* Pulled out before `flags` as `againstIn` is; a version where that takes a count. */
export const sinceReleaseIn = (argv) => {
  const at = argv.indexOf("--since-release");
  if (at < 0) return { release: undefined, rest: argv };
  const next = argv[at + 1];
  if (next === undefined || next.startsWith("--")) return { release: null, rest: argv.filter((one, n) => n !== at) };
  return { release: next, rest: argv.filter((one, n) => n !== at && n !== at + 1) };
};

/** The release reading a version names, or the newest held for this project. */
export const resolveRelease = (scope, asked, { verb, list, writes }) => {
  const held = marksOf(RELEASES, scope);
  if (!held.length) {
    fail(`${verb}: --since-release names no reading — none is held for this project yet; ${writes}. \`${list}\` lists what is held.`);
  }
  if (asked === null) return held.at(-1);
  const found = held.findLast((one) => one.version === asked);
  if (found) return found;
  fail(`${verb}: no release reading for version ${asked} on this project. \`${list}\` lists what is held.`);
  return null;
};

/** The reading `--against` names, or the newest of the scope; refused by name, with the list subject. */
export const resolveAgainst = (kind, asked, { scope = null, verb, list, writes }) => {
  const held = marksOf(kind, scope);
  const whose = kind === RUNS ? "for this project" : "on this device";
  if (asked === null) {
    if (held.length) return held.at(-1);
    fail(`${verb}: --against names no reading — none is held ${whose} yet; ${writes}. \`${list}\` lists what is held.`);
  }
  const found = held.findLast((one) => one.mark === asked);
  if (found) return found;
  fail(`${verb}: no ${kind} reading at mark ${asked} ${whose}. \`${list}\` lists what is held.`);
  return null;
};

const WHEN = 16;
export const stamped = (iso) => iso.slice(0, 16).replace("T", " ");
/** The `--against` line both evals print, and the one sentence saying the two windows meet. The count is each eval's own unit and the span its own reading; the wording and the two spaces are neither, and a case pinning them could otherwise drift in one harness alone. */
export const heldAtMark = (count, mark, span, overlapping) =>
  `the ${count} held at mark ${mark}  ${span}`
  + (overlapping ? "  — overlapping the recent window, which begins before this one ends" : "");

/** One line per reading, newest first; `describe` says the recent window's size and bounds in its kind's units. */
export const markLines = (records, describe) =>
  [...records].reverse().map((one) => `mark ${String(one.mark).padStart(5)}  ${stamped(one.at).padEnd(WHEN)}  ${describe(one)}`);
