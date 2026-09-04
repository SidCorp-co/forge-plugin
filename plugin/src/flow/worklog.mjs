/* The run's state beside the lease: which branch and head, what it touched, which codex round it
   was in, and the dead ends. The record says what earned each status; this says what the last run
   knew and would otherwise go down with its shell (ISS-44). docs/FORGE-CLI.md. */
import { spawnSync } from "node:child_process";

import { fail } from "../resolve/settings.mjs";
import { pluginCopy } from "../tools/plugin-copy.mjs";

import {
  answered, countedIn, logEntries, numbered, undecidedIn, unverdicted, verdictsBy,
} from "../codex/codex-log.mjs";

export const KEY = "worklog";
export const OPEN_KEPT = 8;

/* Read off the run, never typed; without the last one a run behind the tree reads like one on it. */
const FACTS = ["branch", "head", "base", "touched", "files", "at", "copy"];
const REMOTES = ["origin/main", "origin/master"];

const asLine = (value) => String(value ?? "").replace(/[\r\n]+/gu, " ").trim() || null;

export const worklogOf = (context) => {
  const held = context?.[KEY];
  if (!held || typeof held !== "object") return null;
  const out = {};
  for (const name of FACTS) if (held[name]) out[name] = String(held[name]);
  if (held.review && typeof held.review === "object") out.review = held.review;
  const open = Array.isArray(held.open) ? held.open.map(asLine).filter(Boolean) : [];
  if (open.length) out.open = open;
  return Object.keys(out).length ? out : null;
};

/* Field by field, and `open` appended rather than replaced: a patch spread over the block would
   drop every line already there. A patch value of null clears the field, so one capture cannot
   leave another's fact behind it. Past the cap the oldest goes, handed back to be said. */
export const merged = (held, patch) => {
  if (!patch) return { worklog: held, dropped: [] };
  const { open = [], ...rest } = patch;
  const lines = [...(held?.open ?? []), ...open.map(asLine).filter(Boolean)];
  const kept = lines.slice(-OPEN_KEPT);
  const next = { ...(held ?? {}), ...rest, ...(kept.length ? { open: kept } : {}) };
  for (const [name, value] of Object.entries(rest)) if (value === null) delete next[name];
  return { worklog: next, dropped: lines.slice(0, lines.length - kept.length) };
};

/* Null where git would not answer: otherwise a failed diff and an empty one read the same. */
const git = (args) => {
  const run = spawnSync("git", args, { encoding: "utf8" });
  return run.status === 0 ? (run.stdout ?? "").trim() : null;
};

/* The project's own answer first; the two common names are a guess, tried only after it. */
const baseOf = () => {
  const named = git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  for (const ref of [named, ...REMOTES].filter(Boolean)) {
    const found = git(["merge-base", "HEAD", ref]);
    if (found) return found;
  }
  return "";
};

/* Read here and nowhere else: a brief that consulted the tree would answer differently per machine. */
export const gitNow = () => {
  const head = git(["rev-parse", "HEAD"]);
  if (!head) return null;
  const base = baseOf();
  const diffed = base ? git(["diff", "--name-only", `${base}..HEAD`]) : "";
  const touched = (diffed ?? "").split("\n").filter(Boolean);
  return {
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]) || "detached",
    head,
    base: base || null,
    touched: touched.length ? touched.join(", ") : null,
    /* Counted from the list, since a name with ", " in it reads as two. */
    files: diffed === null ? null : touched.length,
    at: new Date().toISOString(),
  };
};

/* What the review owes, from what the log can answer and nothing invented: a verdict on findings
   nobody decided, a recheck where the last word was not one, or clean. */
export const owedOn = (entries, last) => {
  const open = unverdicted(entries, last.root);
  if (open) return `verdict owed on ${open.open.join(", ")}`;
  const ids = numbered(last.reply).map((one) => one.id);
  const made = countedIn(last.reply)?.total ?? ids.length;
  if (!made) return last.recheck ? "clean" : "recheck owed: the last word was not a recheck";
  return undecidedIn(ids, verdictsBy(entries).get(last.id ?? last.at)).length ? "verdict owed" : "recheck owed";
};

/* The consult id is the round: the log numbers no rounds, and a streak rule only this code knew
   would be a number nobody could check. `forge codex log --id <id>` expands it. */
export const reviewNow = (root = process.cwd()) => {
  const entries = logEntries();
  const last = answered(entries).filter((one) => one.root === root).at(-1);
  if (!last) return null;
  return {
    consult: String(last.id ?? last.at),
    recheck: Boolean(last.recheck),
    findings: countedIn(last.reply)?.total ?? numbered(last.reply).length,
    owed: owedOn(entries, last),
  };
};

/** What a capture holds, or why it holds nothing: after a fast-forward the base is the head and the
 *  touched set reads as none, which three captures wrote in silence and two wrote whole (ISS-65). */
const EMPTY = {
  none: "git answered nothing about this checkout",
  base: "no base: the checkout names no remote head to measure from",
  same: "the base is the head, which is what a fast-forward leaves",
  diff: "git would not read the diff between the base and the head",
  files: "the base and the head differ and no file does",
};

const emptyWhy = (git) => {
  if (!git) return EMPTY.none;
  if (!git.base) return EMPTY.base;
  if (git.base === git.head) return EMPTY.same;
  if (git.files === null) return EMPTY.diff;
  return EMPTY.files;
};

export const capturedLine = (git) => {
  const files = git?.files ?? 0;
  if (!git || !files || !git.base || git.base === git.head) {
    return `--pushed: nothing to capture — ${emptyWhy(git)}. The worklog is unchanged, and what it `
      + "holds is whatever the last capture wrote. Capture at the push, before the merge.";
  }
  return `--pushed: ${git.branch} at ${git.head.slice(0, 7)}, base ${git.base.slice(0, 7)}, `
    + `${files} file(s) touched.`;
};

const captured = (git) => Boolean(git?.touched) && Boolean(git.base) && git.base !== git.head;

/* Null where the install record says nothing: a copy invented here is the very fact this prevents. */
const copyNow = () => {
  const held = pluginCopy();
  if (!held) return null;
  const behind = held.stale ? ", in no install record" : held.running === held.installed ? "" : `, ${held.installed} installed`;
  return `${held.name} ${held.running}${behind}`;
};

/* Asked for and not made is not written silently: no git is the wrong directory, no consult is early. */
export const patchFrom = ({ pushed = false, review = false, open = [] }) => {
  const patch = {};
  if (pushed) {
    const now = gitNow();
    if (!now) fail(`--pushed reads the branch and head from git, and ${process.cwd()} is no checkout.`);
    console.error(capturedLine(now));
    if (captured(now)) Object.assign(patch, now, { copy: copyNow() });
  }
  const held = review ? reviewNow() : null;
  if (review && !held) console.error("--review: no answered consult for this checkout yet, so the review block is unchanged.");
  if (held) patch.review = held;
  if (open.length) patch.open = open;
  return Object.keys(patch).length ? patch : null;
};

/* Merged where the write is made, so the drop is said by the command that caused it. */
export const worklogFor = (context, patch) => {
  const { worklog, dropped } = merged(worklogOf(context), patch);
  for (const one of dropped) {
    console.error(`worklog: past ${OPEN_KEPT} open lines, the oldest is dropped — ${one}`);
  }
  return worklog ?? undefined;
};

const reviewLine = (held) =>
  `consult ${held.consult}${held.recheck ? ", recheck" : ""}, ${held.findings} finding(s), ${held.owed}`;

/* In the order a successor asks; a fact nobody wrote is left out rather than printed empty. */
export const worklogLines = (worklog, next = null) => {
  const out = next ? [`next        ${next}`] : [];
  for (const name of ["branch", "head", "base"]) {
    if (worklog?.[name]) out.push(`${name.padEnd(11)} ${worklog[name]}`);
  }
  if (worklog?.touched) out.push(`touched     ${worklog.touched}`);
  if (worklog?.at) out.push(`captured    ${worklog.at.slice(0, 16)}, from git at that moment`);
  if (worklog?.copy) out.push(`copy        ${worklog.copy}`);
  if (worklog?.review) out.push(`review      ${reviewLine(worklog.review)}`);
  for (const one of worklog?.open ?? []) out.push(`open        ${one}`);
  return out;
};
