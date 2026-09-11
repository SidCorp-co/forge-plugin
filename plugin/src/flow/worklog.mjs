/* The run's state beside the lease: which branch and head, what it touched, which codex round it
   was in, and the dead ends. The record says what earned each status; this says what the last run
   knew and would otherwise go down with its shell (ISS-44). docs/cli/resume.md. */
import { spawnSync } from "node:child_process";

import { fail } from "../resolve/settings.mjs";
import { shortSha } from "../tracker/evidence.mjs";
import { pluginCopy } from "../tools/plugin-copy.mjs";

import {
  answered, countedIn, logEntries, numbered, recheckOwed, recheckPlan, undecidedIn, unverdicted,
  verdictsBy,
} from "../codex/codex-log.mjs";
import { atMinute } from "./machine.mjs";

export const KEY = "worklog";
export const OPEN_KEPT = 8;

/* Read off the run, never typed; without `copy` a run behind the tree reads like one on it. */
const FACTS = ["branch", "head", "base", "touched", "files", "at", "copy"];
const REMOTES = ["origin/main", "origin/master"];

/** The half the opening renders, the block below it rendering the rest: one list both readers answer to, so neither prints a fact the other does. Reaching a head is two offline readings for the same reason a claim may not wait on a remote to open. docs/cli/the-work.md. */
export const POINTER = ["branch", "head", "base", "at"];

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
const git = (args, env = null) => {
  const run = spawnSync("git", args, { encoding: "utf8", ...(env ? { env: { ...process.env, ...env } } : {}) });
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
    /* Counted from the list, since a name with ", " in it reads as two; null and never zero, a falsy value being dropped at the read. */
    files: touched.length || null,
    at: new Date().toISOString(),
  };
};

/* What the review owes: a verdict on findings nobody decided, or the recheck one folded owes — and
   whether a recheck is takeable at all is the refusal's own reading, never a second one (ISS-230). */
/* The mirror of `writtenBy` for facts git holds rather than the session: every key is present, so a value a caller typed is cleared and not left standing. A head names a commit and not the tree in hand, so a dirty checkout stamps nothing and neither does no checkout — either way the field is absent, and a citation resting on it is refused rather than claiming a green for files no gate run measured. The two flags are what makes that reading the tree's rather than the machine's: `status.showUntrackedFiles=no` empties the default output over an uncommitted source file, and a submodule set to `ignore=all` hides its own. */
const CLEAN = ["status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"];

const cleanHead = () => (git(CLEAN) === "" ? git(["rev-parse", "HEAD"]) ?? undefined : undefined);

const STAMPS = { head: cleanHead };

export const stampedNow = (shape) => Object.fromEntries(shape.fields
  .filter((one) => one.stamped)
  .map((one) => [one.flag, STAMPS[one.stamped]?.()]));

export const owedOn = (entries, last) => {
  const open = unverdicted(entries, last.root);
  if (open) return `verdict owed on ${open.open.join(", ")}`;
  const ids = numbered(last.reply).map((one) => one.id);
  if (undecidedIn(ids, verdictsBy(entries).get(last.id ?? last.at)).length) return "verdict owed";
  const rels = last.files ?? [];
  return recheckOwed(recheckPlan(entries, last.root, rels), rels) ? "clean" : "recheck owed";
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

/** Why a capture found no diff: after a fast-forward the base is the head and the touched set reads as none. */
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

const captured = (git) => Boolean(git?.touched) && Boolean(git.base) && git.base !== git.head;

/* ISS-65's silence is kept for the diff and dropped for the pointer, which a branch just cut is all there is of. What that costs and buys: docs/cli/the-work.md. */
export const capturedLine = (held) => {
  if (!held) {
    return `--pushed: nothing to capture — ${EMPTY.none}. The worklog is unchanged, and what it `
      + "holds is whatever the last capture wrote.";
  }
  const where = `${held.branch} at ${shortSha(held.head)}`;
  if (!captured(held)) {
    return `--pushed: ${where}, and no diff behind it — ${emptyWhy(held)}. The branch and the head `
      + "are written and the touched set is cleared with them. Capture again at the push.";
  }
  return `--pushed: ${where}, base ${shortSha(held.base)}, ${held.files} file(s) touched.`;
};

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
    Object.assign(patch, now, { copy: copyNow() });
  }
  const held = review ? reviewNow() : null;
  if (review && !held) console.error("--review: no answered consult for this checkout yet, so the review block is unchanged.");
  if (held) patch.review = held;
  if (open.length) patch.open = open;
  return Object.keys(patch).length ? patch : null;
};

/* Merged where the write is made, so the drop is said by the command that caused it — and so is a capture landing over another branch, this being the one place both blocks are in hand. */
export const worklogFor = (context, patch) => {
  const held = worklogOf(context);
  const { worklog, dropped } = merged(held, patch);
  if (patch?.branch && held?.branch && patch.branch !== held.branch) {
    console.error(`worklog: this capture names \`${patch.branch}\`, and the block it replaces named `
      + `\`${held.branch}\`${held.at ? `, captured ${atMinute(held.at)}` : ""}. `
      + "Capture from the checkout the issue's own branch is cut in.");
  }
  for (const one of dropped) {
    console.error(`worklog: past ${OPEN_KEPT} open lines, the oldest is dropped — ${one}`);
  }
  return worklog ?? undefined;
};

const reviewLine = (held) =>
  `consult ${held.consult}${held.recheck ? ", recheck" : ""}, ${held.findings} finding(s), ${held.owed}`;

/* In the order a successor asks; a fact nobody wrote is left out rather than printed empty. The pointer goes before anything renders, so a field added to it leaves here on its own, and `next` is the lease's line rather than a worklog key. */
export const worklogLines = (worklog, next = null) => {
  const held = Object.fromEntries(
    Object.entries(worklog ?? {}).filter(([name]) => !POINTER.includes(name)));
  const out = next ? [`next        ${next}`] : [];
  if (held.touched) out.push(`touched     ${held.touched}`);
  if (held.copy) out.push(`copy        ${held.copy}`);
  if (held.review) out.push(`review      ${reviewLine(held.review)}`);
  for (const one of held.open ?? []) out.push(`open        ${one}`);
  return out;
};

/* Offline is enforced and not assumed: a partial clone fetches a missing object to answer, which is the wait this reading exists to avoid. In the environment and not as a flag, a git too old to know the variable ignoring it where one too old for `--no-lazy-fetch` refuses the call (consult 34d2ee F1). */
const OFFLINE = { GIT_NO_LAZY_FETCH: "1" };

export const reachOf = (work) => {
  if (!work?.head || git(["rev-parse", "--git-dir"], OFFLINE) === null) return null;
  if (git(["cat-file", "-e", `${work.head}^{commit}`], OFFLINE) === null) return { here: false, remote: null };
  const carried = git(["branch", "--remotes", "--contains", work.head], OFFLINE) ?? "";
  /* `origin/HEAD -> origin/master` is that second ref again, and naming it counts one remote as two. */
  const refs = carried.split("\n").map((one) => one.trim()).filter((one) => one && !one.includes(" -> "));
  return { here: true, remote: refs[0] ?? null };
};

export const workNow = (work) => (work?.branch ? { ...work, reach: reachOf(work) } : null);
