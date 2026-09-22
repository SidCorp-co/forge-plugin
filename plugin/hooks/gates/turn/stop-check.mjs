// Refuses the end of a turn that left work red, one line per item and the command that clears it.
// Once per item per turn, so a run that cannot clear one says so and ends. how/stop-check.md.

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { repoRoot } from "../../../src/git/repo-root.mjs";
import { logBytes } from "../../../src/codex/codex-log.mjs";
import { unverdicted, verdictForm } from "../../../src/codex/log/replies.mjs";
import { FIELD, KEY } from "../../../src/flow/lease.mjs";
import { standingIn, startedHere } from "../../../src/flow/lease/holder.mjs";
import { gitProbe } from "../../../src/hooks/git-probe.mjs";
import { linting } from "../../../src/hooks/lint-delegate.mjs";
import { projectStop } from "../../../src/resolve/settings.mjs";
import { lastIdGranted, valueIn } from "../../../src/resolve/session/granted-id.mjs";
import { sessionKey } from "../../../src/shown/ledger.mjs";
import { keysIn } from "../../../src/tracker/issues.mjs";
import { askedAlready, block, done, how, isSubagent, remaining, sinceTurn, transcriptOf, turnAt,
  turnRecords, turnWrites, typed } from "../../_hook.mjs";

const MAX_ISSUES = 2;
const SPARE_MS = 3_000;
const CALL_MS = 8_000;
const GIT_MS = 5_000;
const CLI = fileURLToPath(new URL("../../../src/cli.mjs", import.meta.url));

const left = () => remaining() - SPARE_MS;

/* A harness records a call before it makes it and records the result after, so a process that call
   started was born between the two — at most one spawn past the second, the record being written
   once the tool answers rather than once the kernel has the process. Wide enough that no real wait
   falls outside its own call's window, narrow enough that a sibling run's identical command, made
   in some other call, falls outside this one. */
const SPAWN_MS = 5_000;

/** What this gate reads out of the turn, in one walk of a tail that reaches hundreds of thousands of records: `shell`, the Bash commands, for where the turn stood and whose id it exported; `said`, every tool's command whatever the tool plus each typed prompt's content, for the keys it named; and `calls`, each Bash command with the window the turn's own records put around it, for the processes it left behind. Not the same strings, and no predicate here is another's (ISS-509). */
const readTurn = (records) => {
  const shell = [];
  const said = [];
  const calls = [];
  let last = 0;
  for (const record of sinceTurn(records)) {
    const at = Date.parse(String(record?.timestamp ?? ""));
    if (Number.isFinite(at)) last = Math.max(last, at);
    if (typeof record?.promptSource === "string") said.push(JSON.stringify(record.message?.content ?? ""));
    if (!Array.isArray(record?.message?.content)) continue;
    for (const one of record.message.content) {
      /* The result names the call it answers, so calls the turn made together are each closed by
         their own rather than all of them by whichever came back first. */
      if (one?.type === "tool_result") {
        const call = calls.find((two) => two.id && two.id === one.tool_use_id);
        if (call && call.to === null) call.to = at + SPAWN_MS;
        continue;
      }
      if (one?.type !== "tool_use" || !one.input?.command) continue;
      const command = String(one.input.command);
      said.push(command);
      if (one.name !== "Bash") continue;
      shell.push(command);
      calls.push({ said: command, id: one.id, from: at, to: null });
    }
  }
  /* A call nothing came back for is still running, and the turn is ending now. */
  for (const call of calls) if (call.to === null) call.to = last + SPAWN_MS;
  return { shell, said, calls };
};

const CD = /(?:^|&&|\|\||[;\n])\s*cd\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/gu;

/* Each shell call starts over at `from`; within one, every `cd` moves from where the last one left. A path keeps a character class of its own where an id's is imported: the two are not one question. */
const movedTo = (commands, from) => {
  let last = null;
  for (const command of commands) {
    let at = from;
    let moved = false;
    for (const hit of command.matchAll(CD)) {
      at = resolve(at, valueIn(hit));
      moved = true;
    }
    if (moved) last = at;
  }
  return last;
};

/** The tree a subagent's turn stood in: the repository of the newest file it wrote through the file
 *  tools, else of the directory its last shell call ended in, else the event's cwd. */
const treeOf = (ev, records, shell) => {
  const fallback = ev.cwd || process.cwd();
  if (!isSubagent(ev)) return fallback;
  const newest = turnWrites(records).at(-1);
  const owned = newest ? repoRoot(newest) : null;
  if (owned) return owned;
  const at = movedTo(shell, fallback);
  return at && existsSync(at) ? (repoRoot(at) ?? at) : fallback;
};

/** The id the turn's own writes went under: a run exports its own (ISS-445), which no hook inherits. Read through the file `sessionKey` resolves from, so one run's work is not credited to two holders (ISS-583). */
const holderOf = (ev, shell) => (isSubagent(ev) && lastIdGranted(shell)) || sessionKey(ev);

/** Every `Stop`; a `SubagentStop` only where the project lists its agent type in `stop.agents` — a
 *  plugin's hooks reach every session on the machine, so no subagent is judged until a project says. */
export const judgedStop = (ev, listed = projectStop().agents) => {
  if (!isSubagent(ev)) return true;
  const names = listed ?? [];
  if (!Array.isArray(names) || names.some((one) => typeof one !== "string")) {
    block("`stop.agents` in this project's configuration is a list of agent names, the ones whose stop this gate judges. "
      + "Drop the key and no subagent's stop is judged.");
  }
  const type = String(ev.agent_type ?? "");
  const bare = type.slice(type.lastIndexOf(":") + 1);
  return names.includes(type) || names.includes(bare);
};

/* Once per item per turn: a run that cannot clear one ends with it named, not looping here. */
const asked = (ev, at, item, set) => askedAlready(ev, `${item}@${at}`, "stop-check", { set });

/* Read in a child process, not in here: the CLI exits the process on a missing credential and
   sleeps between retries, and either one inside this hook takes every gate's answer with it. The
   clock is the event's and it is spent, so each child is measured against what is left rather than
   against what the first one had: a kill takes every refusal already gathered with it. `GIT_MS` above is flat instead, and clamping it to what is left changes which turns get a dirty-tree refusal, so it is ISS-388's. */
const forge = (tree, argv) => {
  const ms = Math.min(CALL_MS, left());
  if (ms < 1000) return null;
  try {
    return JSON.parse(execFileSync(process.execPath, [CLI, ...argv], {
      cwd: tree,
      encoding: "utf8",
      timeout: ms,
      stdio: ["ignore", "pipe", "ignore"],
    }));
  } catch {
    return null;
  }
};

/* Untrimmed: a status line begins with two columns and a space, and trimming eats the first one's. */
const git = (tree, argv) => {
  const said = gitProbe(argv, { cwd: tree, ms: GIT_MS });
  return said?.status === 0 ? said.out : null;
};

/* Where a command or this turn's own prompt named one: a key quoted in a diff or in a tool's answer is a key this run read, not one it took. */
const keysNamed = (said) => [...new Set(keysIn(said.join("\n")))];

/** A lease this session took and has written nothing against since. Every payload write renews the
 *  lease and only a claim appends to its history, so a `renewedAt` still standing on the newest
 *  claim is a run that took the issue and said nothing. Read raw and not through `leaseOf`, which fills a default in for every field it does not find and so answers where this would rather throw; the two field names are the ones `lease.mjs` exports. Expiry is deliberately not asked, a lapsed lease this session still holds being the same silence. */
export const silentSince = (lease, holder) => {
  if (!lease || !holder || lease.holder !== holder) return false;
  const claimed = (lease.history ?? []).map((one) => String(one?.at ?? "")).sort().pop() ?? "";
  return String(lease.renewedAt ?? "") <= claimed;
};

/** The issues this turn named that are in one of those. `said` is `readTurn`'s, handed down. */
export const heldAndSilent = (ev, tree, said, holder, read = forge) => {
  const keys = keysNamed(said);
  if (!holder || !keys.length) return [];
  const out = [];
  /* One read per key, status and lease together. The cap counts what qualifies and never what was named, or two closed keys hide the held one behind them; time is the other bound, `forge` answering null once the event's clock is spent. */
  for (const key of keys) {
    if (out.length >= MAX_ISSUES) break;
    const held = read(tree, ["issue", key, "--fields", `status,${FIELD}`]);
    if (held?.status !== "in_progress") continue;
    if (silentSince(held?.[FIELD]?.[KEY], holder)) out.push(key);
  }
  return out;
};

/* A worktree this run made, and not the checkout it was made from: git answers the two directories relatively in the one and absolutely in the other, so both are placed before they are compared. */
const isWorktree = (tree) => {
  const [own, shared] = (git(tree, ["rev-parse", "--git-dir", "--git-common-dir"]) ?? "")
    .split("\n").map((one) => one.trim());
  return Boolean(own && shared) && resolve(tree, own) !== resolve(tree, shared);
};

/* Dirty here and dirtied since this turn began: a tree a read-only turn merely stood in holds
   somebody else's work, and telling this run to put that away is the dangerous direction. */
const leftDirty = (tree, since) => {
  const said = git(tree, ["status", "--porcelain", "--untracked-files=no"]);
  return Boolean(said) && said.split("\n").filter(Boolean).some((one) => {
    try {
      return statSync(join(tree, one.slice(3).split(" -> ").pop())).mtimeMs >= since;
    } catch {
      return false;
    }
  });
};

/* Two readings, because neither reaches the other's case. A worktree is one run's own, so whatever
   stands in it is that run's however it was started; outside one no directory tells this turn's
   process from a sibling run's, both sharing the session's own working directory, and the calls
   the turn made are what does. Each answers `null` where the process table would not enumerate,
   and a reading that could not be made refuses nothing. */
const stillRunning = (tree, since, calls) => {
  const found = new Map();
  const both = [
    ...(isWorktree(tree) ? standingIn(tree, since) ?? [] : []),
    ...(startedHere(calls) ?? []),
  ];
  for (const one of both) found.set(one.pid, one);
  return [...found.values()].sort((one, two) => String(one.since).localeCompare(String(two.since)));
};

const linted = (ev, records) => {
  const found = [];
  const at = (file) => repoRoot(file) ?? dirname(file);
  for (const { file, said } of linting(ev, turnWrites(records), left, { at })) {
    if (said) found.push(`${typed(file)} — ${said.split("\n")[0]}`);
  }
  return found;
};

export const run = (ev, held = heldAndSilent) => {
  if (process.env.FORGE_STOP_DISABLE === "1") done();
  if (!judgedStop(ev)) done();
  const records = turnRecords(transcriptOf(ev)) ?? [];
  /* A subagent's transcript opens on the prompt it was handed, which nobody typed: its turn is the whole of it. */
  const at = turnAt(records) || (isSubagent(ev) ? String(records[0]?.timestamp ?? "") : "");
  const { shell, said, calls } = readTurn(records);
  const tree = treeOf(ev, records, shell);
  const lines = [];
  const say = (item, line) => {
    if (!asked(ev, at, item, true)) lines.push(line);
  };

  for (const one of linted(ev, records)) {
    say(`lint ${one.split(" — ")[0]}`, `Linter: ${one}\n  Clear it: edit the file until the finding is gone.`);
  }

  const open = unverdicted(logBytes(), repoRoot(tree) ?? tree);
  if (open) {
    say(`consult ${open.id}`,
      `Consult ${open.id} made ${open.open.join(", ")} and nothing says what became of them.\n`
      + `  Clear it: \`${verdictForm(open.id)}\`.`);
  }

  if (left() > 1000 && !asked(ev, at, "lease", false)) {
    for (const key of held(ev, tree, said, holderOf(ev, shell))) {
      say("lease", `${key} is in_progress under this session's lease and nothing was written since the claim.\n`
        + `  Clear it: \`forge record park ${key} --kind paused --why "<where you left it>"\`, or advance it.`);
    }
  }

  const since = Date.parse(at);
  if (left() > 1000 && Number.isFinite(since) && isWorktree(tree) && leftDirty(tree, since)) {
    say("tree", `${typed(tree)} is a worktree this turn left with tracked changes uncommitted.\n`
      + `  Clear it: \`git -C ${typed(tree)} add -u && git commit\`.`);
  }

  if (left() > 1000 && Number.isFinite(since)) {
    const standing = stillRunning(tree, since, calls);
    if (standing.length) {
      const [first, ...rest] = standing;
      say("live", `This turn started ${standing.length === 1 ? "a process" : `${standing.length} processes`} `
        + `still standing, pid ${first.pid} (${first.command})${rest.length ? " among them" : ""}.\n`
        + "  Clear it: block on it before this turn ends — `forge hooks --how polling` names the wait.");
    }
  }

  if (lines.length) {
    block(`This turn is ending with work it left red:\n\n${lines.join("\n")}${how()}`);
  }
  done();
};
