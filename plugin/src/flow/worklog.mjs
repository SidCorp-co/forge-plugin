/* The run's state beside the lease: which branch and head, what it touched, which codex round it
   was in, and the dead ends. The record says what earned each status; this says what the last run
   knew and would otherwise go down with its shell (ISS-44). docs/FORGE-CLI.md. */
import { spawnSync } from "node:child_process";

import { fail } from "../resolve/settings.mjs";

import {
  answered, countedIn, logEntries, numbered, undecidedIn, unverdicted, verdictsBy,
} from "../codex/codex-log.mjs";

export const KEY = "worklog";
export const OPEN_KEPT = 8;

const GIT = ["branch", "head", "base", "touched", "at"];
const REMOTES = ["origin/main", "origin/master"];

const asLine = (value) => String(value ?? "").replace(/[\r\n]+/gu, " ").trim() || null;

export const worklogOf = (context) => {
  const held = context?.[KEY];
  if (!held || typeof held !== "object") return null;
  const out = {};
  for (const name of GIT) if (held[name]) out[name] = String(held[name]);
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

const git = (args) => {
  const run = spawnSync("git", args, { encoding: "utf8" });
  return run.status === 0 ? run.stdout.trim() : "";
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
  const touched = base ? git(["diff", "--name-only", `${base}..HEAD`]) : "";
  return {
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]) || "detached",
    head,
    base: base || null,
    touched: touched ? touched.split("\n").filter(Boolean).join(", ") : null,
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

/* Asked for and not made is not written silently: no git is the wrong directory, no consult is early. */
export const patchFrom = ({ pushed = false, review = false, open = [] }) => {
  const patch = {};
  if (pushed) {
    const now = gitNow();
    if (!now) fail(`--pushed reads the branch and head from git, and ${process.cwd()} is no checkout.`);
    Object.assign(patch, now);
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
  if (worklog?.review) out.push(`review      ${reviewLine(worklog.review)}`);
  for (const one of worklog?.open ?? []) out.push(`open        ${one}`);
  return out;
};
