/* The run's state beside the lease: which branch and head, what it touched, which codex round it
   was in, and the dead ends. The record says what earned each status; this says what the last run
   knew and would otherwise go down with its shell (ISS-44). docs/cli/resume.md. */
import { spawnSync } from "node:child_process";

import { fail, keepOnFailure } from "../resolve/settings.mjs";
import { shortSha } from "../tracker/evidence.mjs";
import { pluginCopy } from "../tools/plugin-copy.mjs";


/* The consult log is loaded by the two readings below and by nothing else here, so a run that never asks what the review owes never loads it: named at module scope, it put the whole reply reader and everything under it on the path of every `forge` call, this module being what the lease reaches (ISS-1775). */
const consultLog = () => import("../codex/codex-log.mjs");
const replies = () => import("../codex/log/replies.mjs");
import { jsonLines } from "../hooks/log/hook-log-file.mjs";
import { repoRoot } from "../git/repo-root.mjs";
import { SHAPES, atMinute } from "./machine.mjs";

export const KEY = "worklog";
export const OPEN_KEPT = 8;

/* Read off the run, never typed; without `copy` a run behind the tree reads like one on it. */
const FACTS = ["branch", "head", "base", "touched", "files", "at", "copy", "batch"];
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
  const run = spawnSync("git", args,
    { cwd: process.cwd(), encoding: "utf8", ...(env ? { env: { ...process.env, ...env } } : {}) });
  return run.status === 0 ? (run.stdout ?? "").trim() : null;
};

/* The one reading here whose answer is the exit status: 0 an ancestor, 1 not, anything else no answer. */
const ancestry = (ancestor, of, env) => spawnSync("git", ["merge-base", "--is-ancestor", ancestor, of],
  { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, ...env } }).status;

/* Measured against the branch a change lands on, which is `landsOn`'s answer and the one
   `carriedByLanding` reads: two readings of that branch in one file disagreed, and a capture on a
   project landing on `staging` recorded every file between the remote's default and it as touched
   — which `readyCheckpoint` then copied into the landing (ISS-1217). A declared branch is read and
   nothing else, since a guess standing in for a ref not fetched is that defect again; where nothing
   is declared, the remote's recorded default first and the two common names after it. */
const baseOf = (head, lands) => {
  const named = lands?.branch
    ? [refFor(lands)]
    : [git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]), ...REMOTES];
  for (const ref of named.filter(Boolean)) {
    const found = git(["merge-base", "HEAD", ref]);
    if (found) return found === head ? { ...forkOf(head, ref), carried: true } : { base: found, carried: false };
  }
  return { base: "", carried: false };
};

/* A head the landing branch already holds is its own merge-base, so the plain reading records a
   merged branch as holding nothing (ISS-1862). The merge that took it in still says where it stood:
   among the commits descending from the head, one whose first parent does not is such a merge, and
   that parent's merge-base with the head is the last landing commit the branch held — where it was
   cut, or what it last merged in, the diff from either being the branch's own. No such merge is a
   head the landing branch holds on its own line, a branch just cut or a fast-forward, and there the
   head is the base; merges answering different points are a history naming no one base. */
const forkOf = (head, ref) => {
  const rows = git(["rev-list", "--ancestry-path", "--parents", `${head}..${ref}`]);
  if (rows === null) return { base: "", why: "path" };
  const listed = rows.split("\n").filter(Boolean).map((one) => one.split(" "));
  const within = new Set([head, ...listed.map(([sha]) => sha)]);
  const entries = listed.filter((one) => one.length > 2 && !within.has(one[1]));
  if (!entries.length) return { base: head };
  const forks = new Set(entries.map(([, first]) => git(["merge-base", first, head])));
  if (forks.has(null)) return { base: "", why: "path" };
  const [fork] = forks;
  return forks.size === 1 ? { base: fork } : { base: "", why: "forks" };
};

/* Facts of one reading that the worklog stores none of, so held beside the object they describe
   rather than written to the tracker: why a capture found no base, and the landed mark below, which
   is carried from the capture onto the patch `readyCheckpoint` is handed. */
const NO_BASE = new WeakMap();
const CARRIED = new WeakMap();

/** Whether the capture behind `patch` found the head already on the branch this project lands on. */
export const carriedAtCapture = (patch) => Boolean(patch && CARRIED.get(patch));

/* Read here and nowhere else: a brief that consulted the tree would answer differently per machine.
   `lands` is the project's declaration and never a caller's value, and it picks only the ref the
   base is measured from. */
export const gitNow = (lands = null) => {
  const head = git(["rev-parse", "HEAD"]);
  if (!head) return null;
  const { base, why, carried } = baseOf(head, lands);
  const diffed = base ? git(["diff", "--name-only", `${base}..HEAD`]) : "";
  const touched = (diffed ?? "").split("\n").filter(Boolean);
  const now = {
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]) || "detached",
    head,
    base: base || null,
    touched: touched.length ? touched.join(", ") : null,
    /* Counted from the list, since a name with ", " in it reads as two; null and never zero, a falsy value being dropped at the read. */
    files: touched.length || null,
    at: new Date().toISOString(),
  };
  if (why) NO_BASE.set(now, why);
  if (carried) CARRIED.set(now, true);
  return now;
};

/* What the review owes: a verdict on findings nobody decided, or the recheck one folded owes — and whether a recheck is takeable at all is the refusal's own reading, never a second one (ISS-230). The open findings carry the consult that made them, which after a clean round is not the one this line opens with, and the ids alone sent a run to `--of` the consult the verb refused them on (ISS-1679). */
/* The mirror of `writtenBy` for facts git holds rather than the session: every key is present, so a value a caller typed is cleared and not left standing. A head names a commit and not the tree in hand, so a dirty checkout stamps nothing and neither does no checkout — either way the field is absent, and a citation resting on it is refused rather than claiming a green for files no gate run measured. The two flags are what makes that reading the tree's rather than the machine's: `status.showUntrackedFiles=no` empties the default output over an uncommitted source file, and a submodule set to `ignore=all` hides its own. */
const CLEAN = ["status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"];

const cleanHead = () => (git(CLEAN) === "" ? git(["rev-parse", "HEAD"]) ?? undefined : undefined);

const STAMPS = { head: cleanHead };

export const stampedNow = (shape) => Object.fromEntries(shape.fields
  .filter((one) => one.stamped)
  .map((one) => [one.flag, STAMPS[one.stamped]?.()]));

/** The head the baseline write would stamp, asked for through that write's own stamp so the two cannot disagree about which commit is in hand — a dirty checkout and no checkout both answer with none, which is the head that write would fail to stamp too. */
export const headNow = () => stampedNow(SHAPES.baseline).head ?? null;

/** The paths this checkout holds that `commit` does not carry, read only where `commit` is the head the checkout stands at; null where it is another commit or no checkout answers, since then this tree says nothing about what that commit holds. The status is read untrimmed, its first column being a space for a change left unstaged. */
export const uncommittedOver = (commit) => {
  const head = git(["rev-parse", "HEAD"]);
  if (!head || git(["rev-parse", "--verify", "--quiet", `${commit}^{commit}`]) !== head) return null;
  const status = spawnSync("git", CLEAN, { cwd: process.cwd(), encoding: "utf8" });
  if (status.status !== 0) return null;
  const paths = status.stdout.split("\n").filter(Boolean).map((line) => line.slice(3));
  return paths.length ? paths : null;
};

export const owedOn = async (bytes, entries, last, scope = null) => {
  const { numbered, recheckOwed, recheckPlan, undecidedIn, unverdicted, verdictForm } = await replies();
  const { verdictsBy } = await consultLog();
  const open = unverdicted(bytes, last.root, scope);
  if (open) return `verdict owed on ${open.open.join(", ")} of consult ${open.id} \u2014 ${verdictForm(open.id)}`;
  const ids = numbered(last.reply).map((one) => one.id);
  if (undecidedIn(ids, verdictsBy(entries).get(last.id ?? last.at)).length) return "verdict owed";
  const rels = last.files ?? [];
  return recheckOwed(recheckPlan(entries, last.root, rels), rels) ? "clean" : "recheck owed";
};

/* The consult id is the round: the log numbers no rounds, and a streak rule only this code knew
   would be a number nobody could check. `forge codex log --id <id>` expands it. This run's consults
   in any worktree of the repository, as the verdict verb reads them, so what the capture says is
   owed is what that verb would land on (ISS-898). */
const reviewNow = async (root = repoRoot(process.cwd())) => {
  const { answered, byRun, hereOf, inRepo, logBytes, runOf } = await consultLog();
  const { countedIn, numbered } = await replies();
  const bytes = logBytes();
  const entries = jsonLines(bytes.toString("utf8"));
  const here = hereOf(root);
  const run = runOf();
  const last = answered(entries).filter((one) => inRepo(one, here) && byRun(one, run)).at(-1);
  if (!last) return null;
  return {
    consult: String(last.id ?? last.at),
    recheck: Boolean(last.recheck),
    findings: countedIn(last.reply)?.total ?? numbered(last.reply).length,
    owed: await owedOn(bytes, entries, last, { repo: here.repo, run }),
  };
};

/** Why a capture found no diff: a head the landing branch holds on its own line is its own base, and the touched set reads as none. */
const EMPTY = {
  none: "git answered nothing about this checkout",
  base: "no base: this checkout holds no remote-tracking ref of the branch a change lands on to measure from, which `git fetch origin` settles",
  forks: "no base: the branch a change lands on took this head in through merges that name different points it stood at, so no one of them is the base",
  path: "no base: git would not read how the branch a change lands on took this head in",
  same: "the base is the head: the branch a change lands on already holds everything on it, which is what a branch just cut and a branch landed by a fast-forward both read",
  diff: "git would not read the diff between the base and the head",
  files: "the base and the head differ and no file does",
};

const emptyWhy = (git) => {
  if (!git) return EMPTY.none;
  if (!git.base) return EMPTY[NO_BASE.get(git) ?? "base"];
  if (git.base === git.head) return EMPTY.same;
  if (git.files === null) return EMPTY.diff;
  return EMPTY.files;
};

const captured = (git) => Boolean(git?.touched) && Boolean(git.base) && git.base !== git.head;

/* What a capture read, which is the same sentence whether or not a write carried it. */
const readOf = (held) => `${held.branch} at ${shortSha(held.head)}, `
  + (captured(held) ? `base ${shortSha(held.base)}, ${held.files} file(s) touched` : `and no diff behind it — ${emptyWhy(held)}`);

/* A head that is its own base reads alike just cut and landed by a fast-forward, so the line names the route out of each rather than a push the second has none of left (ISS-2451). */
const againOf = (held) => (held.base && held.base === held.head
  ? "Where the branch was just cut, capture again at the push; where it landed by a fast-forward, no "
    + "push is left to capture, and `claim --rebuilt` writes that landing after the fact."
  : "Capture again at the push.");

/* ISS-65's silence is kept for the diff and dropped for the pointer, which a branch just cut is all there is of. What that costs and buys: docs/cli/the-work.md. */
export const capturedLine = (held) => {
  if (!held) {
    return `--pushed: nothing to capture — ${EMPTY.none}. The worklog is unchanged, and what it `
      + "holds is whatever the last capture wrote.";
  }
  if (!captured(held)) {
    return `--pushed: ${readOf(held)}. The branch and the head `
      + `are written and the touched set is cleared with them. ${againOf(held)}`;
  }
  return `--pushed: ${readOf(held)}.`;
};

/* Null where the install record says nothing: a copy invented here is the very fact this prevents. */
const copyNow = () => {
  const held = pluginCopy();
  if (!held) return null;
  const behind = held.stale ? ", in no install record" : held.running === held.installed ? "" : `, ${held.installed} installed`;
  return `${held.name} ${held.running}${behind}`;
};

/* The capture's line waits for the lease write carrying it, because printed at the reading it told a
   run whose call was refused afterwards that the worklog had moved (ISS-2406). Keyed by the patch,
   the one object every such write is handed. */
const UNSAID = new Map();

const unwrittenLine = (held, why) =>
  `--pushed: ${readOf(held)} — read and not written, ${why}, so the worklog holds whatever the `
  + "last capture wrote. Capture it again on a call that writes it.";

/** Said once the write carrying `patch` has landed, and never again for the same capture. */
export const saidWritten = (patch) => {
  const held = patch ? UNSAID.get(patch) : null;
  if (!held) return;
  UNSAID.delete(patch);
  held.drop();
  console.error(held.line);
};

/** Every capture this call read and no write carried, said at the call's end. */
export const unwrittenSaid = () => {
  for (const [patch, held] of UNSAID) {
    held.drop();
    console.error(unwrittenLine(patch, "since nothing this call wrote carries the worklog"));
  }
  UNSAID.clear();
};

/* Loaded only by a capture, for the reason `consultLog` is: this module is on every call's path. */
const landingBranch = async () => {
  const { landsOn, releasePolicy } = await import("../tracker/project-config.mjs");
  return landsOn(await releasePolicy());
};

/* Asked for and not made is not written silently: no git is the wrong directory, no consult is early. */
export const patchFrom = async ({ pushed = false, review = false, open = [] }) => {
  const patch = {};
  const now = pushed ? gitNow(await landingBranch()) : null;
  if (pushed) {
    if (!now) fail(`--pushed reads the branch and head from git, and ${process.cwd()} is no checkout.`);
    Object.assign(patch, now, { copy: copyNow() });
    for (const held of [NO_BASE, CARRIED]) if (held.has(now)) held.set(patch, held.get(now));
  }
  const held = review ? await reviewNow() : null;
  if (review && !held) console.error("--review: no answered consult for this checkout yet, so the review block is unchanged.");
  if (held) patch.review = held;
  if (open.length) patch.open = open;
  if (now) {
    UNSAID.set(patch, {
      line: capturedLine(now),
      drop: keepOnFailure(unwrittenLine(now, "because the call was refused above")),
    });
  }
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

/* In the order a successor asks; a fact nobody wrote is left out rather than printed empty. The pointer is the opening's and none of it is printed here, which is what `POINTER` says and `SAID` in guides/phases.mjs enforces; `next` is the lease's line rather than a worklog key. */
export const worklogLines = (worklog, next = null) => {
  const held = worklog ?? {};
  const out = next ? [`next        ${next}`] : [];
  if (held.touched) out.push(`touched     ${held.touched}`);
  if (held.copy) out.push(`copy        ${held.copy}`);
  if (held.review) out.push(`review      ${reviewLine(held.review)}`);
  for (const one of held.open ?? []) out.push(`open        ${one}`);
  return out;
};

/* Offline is enforced and not assumed: a partial clone fetches a missing object to answer, which is the wait this reading exists to avoid. In the environment and not as a flag, a git too old to know the variable ignoring it where one too old for `--no-lazy-fetch` refuses the call (consult 34d2ee F1). */
const OFFLINE = { GIT_NO_LAZY_FETCH: "1" };

/* The ref a reach names first, where it carries the head: the landing branch, the one ref that says
   the work is in. None under a reading that did not settle which branch that is, since a report line
   that guessed there would name the branch a release promotes to (ISS-1802). */
const landingRef = (lands) => {
  if (lands?.unsettled) return null;
  if (lands?.branch) return `origin/${lands.branch}`;
  return git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], OFFLINE);
};

/* Out of every ref carrying the head, the one that decides how a run opens: the landing branch, then
   the branch's own, and any other only as what it is, since the first of an alphabetical list read as
   where the work lives and named another issue's branch (ISS-1862). */
export const reachOf = (work, lands = null) => {
  if (!work?.head || git(["rev-parse", "--git-dir"], OFFLINE) === null) return null;
  if (git(["cat-file", "-e", `${work.head}^{commit}`], OFFLINE) === null) return { here: false, remote: null };
  const carried = git(["branch", "--remotes", "--contains", work.head], OFFLINE) ?? "";
  /* `origin/HEAD -> origin/master` is that second ref again, and naming it counts one remote as two. */
  const refs = carried.split("\n").map((one) => one.trim()).filter((one) => one && !one.includes(" -> "));
  if (!refs.length) return { here: true, remote: null };
  const landing = landingRef(lands);
  const own = work.branch ? `origin/${work.branch}` : null;
  const settled = !lands?.unsettled;
  if (landing && refs.includes(landing)) return { here: true, remote: landing, as: "landing", declared: Boolean(lands?.branch) };
  if (own && refs.includes(own)) return { here: true, remote: own, as: "own", landing, settled };
  return { here: true, remote: refs[0], as: "other", landing, settled };
};

/* Where the branch stands in this checkout as the line is printed, since a capture is a reading of
   its moment and the run after it may have moved the branch four commits on (ISS-1862). Read off the
   one ref and never a revision, for the reason `tipOf` gives; a repository's worktrees share it. */
export const branchNow = (work) => {
  if (!work?.branch || !work.head || git(["rev-parse", "--git-dir"], OFFLINE) === null) return null;
  const hash = git(["show-ref", "--verify", "--hash", `refs/heads/${work.branch}`], OFFLINE);
  if (!hash) return { tip: null, carries: null };
  if (hash === work.head) return { tip: hash, carries: true, past: 0 };
  const asked = ancestry(work.head, hash, OFFLINE);
  if (asked === 1) return { tip: hash, carries: false };
  const count = asked === 0 ? git(["rev-list", "--count", `${work.head}..${hash}`], OFFLINE) : null;
  return count === null ? { tip: hash, carries: null } : { tip: hash, carries: true, past: Number(count) };
};

/* Whether a branch dropped a commit it carried, off this checkout's refs and offline as `reachOf` is.
   `--is-ancestor` exiting 1 over a full history proves it and nothing else does: the-turn.md says why. */
export const droppedHead = (branch, head) => {
  if (!branch || !head || git(["rev-parse", "--git-dir"], OFFLINE) === null) return null;
  const tip = git(["rev-parse", "--verify", `refs/remotes/origin/${branch}^{commit}`], OFFLINE);
  if (!tip) return null;
  if (git(["rev-parse", "--is-shallow-repository"], OFFLINE) !== "false") return { tip, dropped: false };
  return { tip, dropped: ancestry(head, tip, OFFLINE) === 1 };
};

/* Whether the branch a change lands on carries a head, and never a name `baseOf` guesses at. A reading it cannot make answers no with what settles it: what rests on this ends a landing, where the refusal above only costs a builder its write, and under no overlay: one proved over a replacement or a graft proves only it (8faf61 F1). */
const PROVEN = { ...OFFLINE, GIT_NO_REPLACE_OBJECTS: "1", GIT_GRAFT_FILE: "/dev/null" };

/* The ref to read, off the project's declaration where `landsOn` made one and off the ref this
   checkout recorded as the remote's own where it did not. Written whole either way: a local
   `origin/master` makes git disambiguate the short form (consult ee55fe F1). */
const refFor = (lands) => (lands?.branch
  ? `refs/remotes/origin/${lands.branch}`
  : git(["symbolic-ref", "refs/remotes/origin/HEAD"], PROVEN));

/* The commit a ref stands at, looked up as that exact ref and never as a revision. Whole is not
   enough on its own: `rev-parse` resolves a name through `refs/heads/<name>` among others, so a
   local branch called `refs/remotes/origin/staging` answers for a remote-tracking ref this checkout
   never fetched — and what rests on this answer ends a landing. `show-ref --verify` reads the one
   ref or nothing, and the object id it gives back is unambiguous where the name was not (F1). */
const tipOf = (held) => {
  const hash = git(["show-ref", "--verify", "--hash", held], PROVEN);
  return hash ? git(["rev-parse", "--verify", `${hash}^{commit}`], PROVEN) : null;
};

/** Whether the branch this project lands changes on reaches a head, given `landsOn`'s answer for
 *  which branch that is. That answer's `from` travels out in this result and both callers print it;
 *  `landsOn` holds why it is carried at all, and why an unsettled reading refuses here before any
 *  branch is read rather than falling to the absence beside it (ISS-1802). */
export const carriedByLanding = (head, lands = null) => {
  const from = lands?.from ?? null;
  const short = (why, route, ref = null, tip = null) => ({ ref, tip, from, carries: false, why, route });
  if (lands?.unsettled) return short(lands.unsettled, lands.route);
  if (git(["rev-parse", "--git-dir"], PROVEN) === null) return short("this directory is no git checkout", null);
  const held = refFor(lands);
  if (!held) {
    return short("this checkout has recorded no default branch for `origin`, so there is no branch "
      + "to read the ancestry against", "git remote set-head origin -a");
  }
  const ref = held.replace(/^refs\/remotes\//u, "");
  const tip = tipOf(held);
  if (!tip) return short(`${ref} resolves to no commit here`, "git fetch origin", ref);
  if (git(["rev-parse", "--is-shallow-repository"], PROVEN) !== "false") {
    return short("this checkout is shallow, so no ancestry read over it settles anything",
      "git fetch --unshallow origin", ref, tip);
  }
  if (git(["cat-file", "-e", `${head}^{commit}`], PROVEN) === null) {
    return short("this checkout holds no commit of that name, whether the branch was never fetched "
      + "here or the object is gone from a store that has the rest", "git fetch origin", ref, tip);
  }
  const asked = ancestry(head, tip, PROVEN);
  if (asked === 0) return { ref, tip, from, carries: true, why: null, route: null };
  if (asked === 1) {
    return short(`${ref} stands at ${shortSha(tip)} and does not reach it`, "git fetch origin", ref, tip);
  }
  return short(`git could not answer whether ${ref} reaches it`, null, ref, tip);
};

/** The worklog beside what this checkout observes of it: which ref carries its head, and where its branch stands. */
export const workNow = async (work) => {
  if (!work?.branch) return null;
  const lands = await landingBranch();
  return { ...work, reach: reachOf(work, lands), now: branchNow(work) };
};
