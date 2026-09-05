// Refuses the end of a turn that left work red, one line per item and the command that clears it.
// Once per item per turn, so a run that cannot clear one says so and ends. how/stop-check.md.

import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { repoRoot } from "../../../src/codex/codex.mjs";
import { logEntries, unverdicted, verdictForm } from "../../../src/codex/codex-log.mjs";
import { FIELD, KEY } from "../../../src/flow/lease.mjs";
import { gitProbe } from "../../../src/hooks/git-probe.mjs";
import { linting } from "../../../src/hooks/lint-delegate.mjs";
import { sessionKey } from "../../../src/tracker/comments.mjs";
import { keysIn } from "../../../src/tracker/issues.mjs";
import { askedAlready, block, done, how, remaining, sinceTurn, turnAt, turnRecords, turnWrites, typed }
  from "../../_hook.mjs";

const MAX_ISSUES = 2;
const SPARE_MS = 3_000;
const CALL_MS = 8_000;
const GIT_MS = 5_000;
const CLI = fileURLToPath(new URL("../../../src/cli.mjs", import.meta.url));

const left = () => remaining() - SPARE_MS;

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

/* Where a command or this turn's own prompt named one: a key quoted in a diff or in a tool's answer
   is a key this run read, not one it took. */
const keysNamed = (records) => {
  const said = [];
  for (const record of sinceTurn(records)) {
    if (typeof record?.promptSource === "string") said.push(JSON.stringify(record.message?.content ?? ""));
    if (!Array.isArray(record?.message?.content)) continue;
    for (const block of record.message.content) {
      if (block?.type === "tool_use" && block.input?.command) said.push(String(block.input.command));
    }
  }
  return [...new Set(keysIn(said.join("\n")).map((one) => one.toUpperCase()))];
};

/** A lease this session took and has written nothing against since. Every payload write renews the
 *  lease and only a claim appends to its history, so a `renewedAt` still standing on the newest
 *  claim is a run that took the issue and said nothing. Read raw and not through `leaseOf`, which fills a default in for every field it does not find and so answers where this would rather throw; the two field names are the ones `lease.mjs` exports. Expiry is deliberately not asked, a lapsed lease this session still holds being the same silence. */
export const silentSince = (lease, holder) => {
  if (!lease || !holder || lease.holder !== holder) return false;
  const claimed = (lease.history ?? []).map((one) => String(one?.at ?? "")).sort().pop() ?? "";
  return String(lease.renewedAt ?? "") <= claimed;
};

/** The issues this turn named that are in one of those. */
export const heldAndSilent = (ev, tree, records) => {
  const holder = sessionKey(ev);
  const keys = keysNamed(records);
  if (!holder || !keys.length) return [];
  const listed = forge(tree, ["call", "forge_issues",
    JSON.stringify({ action: "list", filters: { status: "in_progress" }, limit: 200 })]);
  const rows = (listed?.issues ?? []).filter((row) => keys.includes(String(row?.issueId).toUpperCase()));
  const out = [];
  for (const row of rows.slice(0, MAX_ISSUES)) {
    const lease = forge(tree, ["issue", row.issueId, "--fields", FIELD])?.[FIELD]?.[KEY];
    if (silentSince(lease, holder)) out.push(row.issueId);
  }
  return out;
};

/* A worktree this run made, and not the checkout it was made from: git answers the two directories
   relatively in the one and absolutely in the other, so both are placed before they are compared. */
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
  const records = turnRecords(ev.transcript_path ?? "") ?? [];
  const at = turnAt(records);
  const tree = ev.cwd || process.cwd();
  const lines = [];
  const say = (item, line) => {
    if (!asked(ev, at, item, true)) lines.push(line);
  };

  for (const one of linted(ev, records)) {
    say(`lint ${one.split(" — ")[0]}`, `Linter: ${one}\n  Clear it: edit the file until the finding is gone.`);
  }

  const open = unverdicted(logEntries(), repoRoot(tree) ?? tree);
  if (open) {
    say(`consult ${open.id}`,
      `Consult ${open.id} made ${open.open.join(", ")} and nothing says what became of them.\n`
      + `  Clear it: \`${verdictForm(open.id)}\`.`);
  }

  if (left() > 1000 && !asked(ev, at, "lease", false)) {
    for (const key of held(ev, tree, records)) {
      say("lease", `${key} is in_progress under this session's lease and nothing was written since the claim.\n`
        + `  Clear it: \`forge record park ${key} --kind paused --why "<where you left it>"\`, or advance it.`);
    }
  }

  const since = Date.parse(at);
  if (left() > 1000 && Number.isFinite(since) && isWorktree(tree) && leftDirty(tree, since)) {
    say("tree", `${typed(tree)} is a worktree this turn left with tracked changes uncommitted.\n`
      + `  Clear it: \`git -C ${typed(tree)} add -u && git commit\`.`);
  }

  if (lines.length) {
    block(`This turn is ending with work it left red:\n\n${lines.join("\n")}${how()}`);
  }
  done();
};
