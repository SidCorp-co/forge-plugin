/* The readings both harness evals write at a mark and read back as a pinned before window: one store, kept as the
   consult log keeps its entries. What a project reading is held under is `scopeOf` below; a consult
   reading is the device's and is held under nothing. docs/cli/stats-the-mark.md. */
import { join } from "node:path";

import { copyFileSync, existsSync, renameSync, statSync, writeFileSync } from "node:fs";

import { appendJsonl, jsonlAt, jsonlBack, jsonlBytes, jsonlMark } from "../../hooks/log/hook-log-file.mjs";
import { configDir } from "../../resolve/config.mjs";
import { UNKNOWN_DEVICE } from "../../resolve/machine/device.mjs";
import { underLock } from "../../resolve/machine/file-lock.mjs";
import { checkoutAt } from "../../git/checkout-at.mjs";
import { fail, projectAt } from "../../resolve/settings.mjs";
import { aheadSaid, anchoredAt, overlapSaid } from "./overlap.mjs";
import { stamp } from "../figures.mjs";

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
/* What says a pass has run. The store itself cannot answer it: a record a pass left alone is
   indistinguishable from one it never reached, so asking the records would run for ever. */
const donePath = (marker) => `${marksPath()}.${marker}`;
/* The store as it stood, written before a byte of it is rewritten, and the whole of the way back.
   One copy per pass and never one shared between them: a pass runs over a store that has gained
   records since the pass before it, so an earlier pass's copy answers for a store this one never
   saw and would restore neither what this pass took nor what arrived after it (ISS-2106). */
const asidePath = (issue) => `${marksPath()}.before-${issue}`;

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

/* The store's bytes as this process last read them, and which file in which state they were read
   from. One command asks the store for several kinds and scopes, and each asking re-read the whole
   file (ISS-1510). Keyed on the file's identity and its size and times rather than held for the
   process: another process appends to the same store, and a reading served from before that append
   would be a reading of a store that no longer exists. `forget` is what this process's own writes
   call, since a write here is the one change this process is certain of. */
let held = null;

const stateOf = (path) => {
  try {
    const at = statSync(path, { bigint: true });
    return { size: Number(at.size), key: `${at.dev}:${at.ino}:${at.size}:${at.mtimeNs}:${at.ctimeNs}` };
  } catch {
    return null;
  }
};

/* Stated before the read, so bytes read after a concurrent append are newer than the state they are
   held under. Held only where the bytes are exactly the size stated: more is an append landing
   between the two, and none from a file stated as holding some is a read `jsonlBytes` answered
   with nothing because it failed, which held would stand for the store until the file next moved. */
const storeBytes = () => {
  const path = marksPath();
  const state = stateOf(path);
  if (state !== null && held?.path === path && held.key === state.key) return held.bytes;
  const bytes = jsonlBytes(path);
  held = state?.size === bytes.length ? { path, key: state.key, bytes } : null;
  return bytes;
};

const forget = () => {
  held = null;
};

/** The readings of one kind, oldest first, for one scope — or for every scope where none is named,
 *  which is what a consult reading is held under. Only the records carrying that scope are parsed:
 *  the store is a file every reading ever taken is appended to, and parsing all of it to answer for
 *  one project is what made every reading pay for every reading (ISS-1984). */
const scanOf = (kind, scope) => {
  const every = scope === null ? [] : [jsonlMark("scope", scope)];
  return [...jsonlBack(storeBytes(), [jsonlMark("kind", kind)], every)].reverse();
};

export const marksOf = (kind, scope = null, waits) => {
  passed(waits);
  return scanOf(kind, scope);
};

/** What of a reading is written down: every field but the two no reader of a stored reading reads —
 *  the reading's own earlier window, which is a copy of what the record before it already holds, and
 *  the class table it was taken under. A stored reading stands where the sliding before window would,
 *  so its recent window is what a reader takes and neither of these is.
 *
 *  **Here, in the store's own write, and not at each writer.** The projection began at the two
 *  writers that were in front of the run that added it, and the third — the consult crossing's — went
 *  on spreading its reading raw, so the store kept gaining a dead window every hundredth answered
 *  consult while the rule read as kept. A rule every writer has to remember is a rule the next writer
 *  will not (ISS-2106). */
const withoutDead = (record) => {
  const kept = { ...record };
  delete kept.before;
  delete kept.classes;
  return kept;
};

/* What a record already held is owed. Its OWN recorded checkout and never the one this process is
   standing in: `root` is a scratch path, and decoding a project out of one would be a guess wearing a
   reading's clothes. A record naming no checkout at all keeps its figures under no scope and is
   reported, there being nothing about it to resolve. */
const scopeHeld = (one) => (one.project ? scopeOf(one.project) : null);

/* One rewrite and never a second. Every record is written back keeping every field it holds and
   gaining only the scope `scopeHeld` works out for it. */
const scopedHeld = (held) => {
  const left = [];
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
  return { lines, report: { unresolved: left.length, checkouts: [...new Set(left)] } };
};

/* The same projection the store's own write makes, over the records written before it made it. Every
   other field each record holds is untouched, the scope a record never gained included: a record this
   pass cannot key is none of its business, the field and not the kind being its whole criterion. */
const prunedHeld = (held) => {
  let dropped = 0;
  const lines = held.map((one) => {
    const kept = withoutDead(one);
    if (Object.keys(kept).length !== Object.keys(one).length) dropped += 1;
    return JSON.stringify(kept);
  });
  return { lines, report: { pruned: dropped } };
};

/* Every one-time pass over every record the store holds, in the order they are owed: the marker that
   says one has run, the issue whose name its way back carries, and what it makes of the records. Each
   stands behind its own marker, so a home that has taken an earlier pass takes only what came after
   it, and a pass added later is a row here rather than a second copy of the dance below. */
const PASSES = [
  { marker: "migrated", issue: "ISS-1984", over: scopedHeld },
  { marker: "pruned", issue: "ISS-2106", over: prunedHeld },
];

const onePass = ({ marker, issue, over }) => {
  if (existsSync(donePath(marker))) return;
  const held = readAll();
  /* Asked whatever the store holds, so the report a marker carries has one shape on an empty store
     and on a full one. It only builds strings, the store standing untouched until the rename below,
     so asking it first costs the way back nothing. */
  const made = over(held);
  if (held.length) {
    /* Once, and never over a backup already published: a rewrite interrupted after the store was
       renamed leaves the next attempt reading records already rewritten, and copying THOSE over the
       way back would destroy the very bytes it exists to hold. Copied aside and renamed into place,
       so a copy interrupted half way is not mistaken for a finished one. */
    if (!existsSync(asidePath(issue))) {
      const part = `${asidePath(issue)}.part`;
      copyFileSync(marksPath(), part);
      renameSync(part, asidePath(issue));
    }
    const next = `${marksPath()}.next`;
    writeFileSync(next, `${made.lines.join("\n")}\n`, { mode: 0o600 });
    /* Renamed rather than written over: a rewrite interrupted half way would leave the store torn,
       and the copy beside it is the way back only if the store it answers for is whole. */
    renameSync(next, marksPath());
    forget();
  }
  writeFileSync(donePath(marker), `${JSON.stringify({
    at: new Date().toISOString(), records: held.length, ...made.report,
    kept: held.length ? asidePath(issue) : null,
  })}\n`, { mode: 0o600 });
};

const passHeld = () => {
  for (const pass of PASSES) onePass(pass);
};

/* Outside the lock where the marker already answers, since that is every call but the first one this
   machine ever makes, and the lock is what two crossing writers are queued by and not what a read is. */
/* Strict, so a writer that could not take the lock says the reading is not held rather than writing
   beside another one, and so that a holder still running is waited on however long its work takes
   rather than evicted by the clock — the guarded work here is the rewrite of every record the store
   holds. The budget is the one of the three a caller may name: whether a lost reading is worth
   refusing over is the store's to price and stays here, while what a call may spend waiting belongs
   to whoever holds the clock, as `tracker/rest.mjs` already takes `waits` from a caller. */
const WAITS_MS = 30_000;
const guarded = (waits = WAITS_MS) => ({ strict: true, waits });

const passed = (waits) => {
  if (PASSES.every((pass) => existsSync(donePath(pass.marker)))) return;
  try {
    underLock(lockPath(), passHeld, guarded(waits));
  } catch {
    /* A store this machine cannot write is one no pass can rewrite either. The read goes on over
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
const HELD = "held";
const FAILED = "failed";

/** Appends unless the same reading is held, and says which — written, held or failed. A failed write is said and carried past, as the consult log's is: the mark line it accompanies is worth more than a stats file. The check and the append are one act under the store's own lock: the eval writes a reading as well as the ship now, so two processes crossing one window would otherwise both read no reading and both append one, and a record of this size is far past the bytes a single append is atomic in. */
export const writeMark = (record, waits) => {
  try {
    return underLock(lockPath(), () => {
      passHeld();
      if (scanOf(record.kind, record.scope ?? null).some((one) => sameMark(one, record))) return HELD;
      appendJsonl(marksPath(), withoutDead(record), configDir("forge"));
      forget();
      return WRITTEN;
    }, guarded(waits));
  } catch (error) {
    console.error(`stats: could not write ${marksPath()} (${error.message}); this reading is not held.`);
    return FAILED;
  }
};

/** `ahead` is the written reading's own window as `{ count, size, terms }`, which `aheadSaid` turns into
 *  what a comparison against it can answer yet. */
export const wroteSaid = (outcome, mark, verb, { count, size, terms }) => ({
  [WRITTEN]: `The reading is held as mark ${mark}, and ${aheadSaid(`${verb} --against ${mark}`, count, size, terms)}.`,
  [HELD]: `Mark ${mark} was already held, so nothing was written.`,
  [FAILED]: `The reading could not be written, so mark ${mark} is not held.`,
}[outcome]);

/** The same three outcomes said in a release's own identity, a count being none of it; `ahead` as above. */
export const releaseSaid = (outcome, version, { count, size, terms }) => ({
  [WRITTEN]: `The reading is held at that version, and ${aheadSaid(`forge stats eval --since-release ${version}`, count, size, terms)}.`,
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

/** The release reading a version names, or the newest held for this project that shares none of the
 *  recent window; one sharing most of it is refused (`overlap.mjs`, which `recent` is handed to). */
export const resolveRelease = (scope, asked, { verb, list, writes, recent }) => {
  const held = marksOf(RELEASES, scope);
  if (!held.length) {
    fail(`${verb}: --since-release names no reading — none is held for this project yet; ${writes}. \`${list}\` lists what is held.`);
  }
  const found = asked === null ? null : held.findLast((one) => one.version === asked);
  if (asked !== null && !found) fail(`${verb}: no release reading for version ${asked} on this project. \`${list}\` lists what is held.`);
  return anchoredAt(held, found, { ...recent, flag: "--since-release" }, verb);
};

/** The count mark `--against` names, refused by name with the list subject where nobody wrote it;
 *  a bare flag and a mostly-shared reading are judged as `resolveRelease` judges them. */
export const resolveAgainst = (kind, asked, { scope = null, verb, list, writes, recent }) => {
  const held = marksOf(kind, scope);
  const whose = kind === RUNS ? "for this project" : "on this device";
  if (!held.length && asked === null) {
    fail(`${verb}: --against names no reading — none is held ${whose} yet; ${writes}. \`${list}\` lists what is held.`);
  }
  const found = asked === null ? null : held.findLast((one) => one.mark === asked);
  if (asked !== null && !found) fail(`${verb}: no ${kind} reading at mark ${asked} ${whose}. \`${list}\` lists what is held.`);
  return anchoredAt(held, found, { ...recent, flag: "--against" }, verb);
};

const WHEN = stamp(0).length;
/** The `--against` line both evals print, ending on what it shares of the recent window. The count is each eval's own unit, the span its own reading and the overlap its own rows; the wording and the two spaces are neither, and a case pinning them could otherwise drift in one harness alone. */
export const heldAtMark = (count, mark, span, overlap, terms) =>
  `the ${count} held at mark ${mark}  ${span}${overlapSaid(overlap, terms)}`;

/** One line per reading, newest first; `describe` says the recent window's size and bounds in its kind's units. */
export const markLines = (records, describe) =>
  [...records].reverse().map((one) => `mark ${String(one.mark).padStart(5)}  ${stamp(one.at).padEnd(WHEN)}  ${describe(one)}`);
