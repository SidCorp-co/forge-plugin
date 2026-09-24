/* A consult belongs to a repository and to a run, not to a directory: every delegated run stands in a
   worktree of its own while the checkout it came from sends commands too, and the verdict verb read
   one root and no run, so it refused an id a line away and landed on another run's consult (ISS-898).
   Over a real `git worktree add`, because the key is what git writes and a stand-in path would pass
   whatever the walk did. */
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { git, standsInNoTree, tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: these cases write the log, and the developer's own is live. */
const sandbox = tempRoom("forge-codex-repository-");
process.env.XDG_CONFIG_HOME = sandbox;
standsInNoTree("forge-codex-repository");

const { logEntries, logPath } = await import("../../../src/codex/codex-log.mjs");
const { verdict } = await import("../../../src/codex/log/verbs.mjs");
const { windowOf } = await import("../../../src/codex/codex-stats.mjs");
const { patchFrom } = await import("../../../src/flow/worklog.mjs");
const { refusing } = await import("../../../src/resolve/settings.mjs");
const { repoRoot } = await import("../../../src/git/repo-root.mjs");

const primaryAt = tempRoom("codex-repository-primary-");
spawnSync("git", ["init", "-q", primaryAt], { cwd: primaryAt });
writeFileSync(join(primaryAt, "a.txt"), "a\n");
git(primaryAt, "add", ".");
git(primaryAt, "commit", "-qm", "one");
const siblingAt = join(tempRoom("codex-repository-sibling-"), "wt");
git(primaryAt, "worktree", "add", "-q", siblingAt);
const strangerAt = tempRoom("codex-repository-stranger-");
spawnSync("git", ["init", "-q", strangerAt], { cwd: strangerAt });

const PRIMARY = repoRoot(primaryAt);
const SIBLING = repoRoot(siblingAt);
const STRANGER = repoRoot(strangerAt);

const OPEN = "CODEX: 1 findings (1 major)\n- **F1 — New — major:** `a.txt:1` — one.";
const consult = (id, run, root, { repo = root === SIBLING ? PRIMARY : root, at = "2026-09-24T00:00:00.000Z", reply = OPEN } = {}) => ({
  kind: "consult", id, ok: true, at, root, ...(repo === null ? {} : { repo }), files: [`${id}.md`], reply,
  ...(run ? { run, runFrom: "asked" } : { runFrom: "none" }),
});

const logged = (rows) => {
  mkdirSync(dirname(logPath()), { recursive: true });
  writeFileSync(logPath(), rows.map((one) => `${JSON.stringify(one)}\n`).join(""));
};

/* The call as a shell makes it: this run's id in the environment, and whatever the verb prints. */
const asRun = async (run, then) => {
  const kept = ["FORGE_SESSION_ID", "CLAUDE_CODE_SESSION_ID"].map((name) => [name, process.env[name]]);
  for (const [name] of kept) delete process.env[name];
  if (run) process.env.FORGE_SESSION_ID = run;
  const said = mock.method(console, "log", () => {});
  const warned = mock.method(console, "error", () => {});
  try {
    const refused = await refusing(async () => {
      try {
        await then();
        return null;
      } catch (error) {
        return error.message;
      }
    });
    return { refused, said: said.mock.calls.map((call) => String(call.arguments[0])).join("\n") };
  } finally {
    said.mock.restore();
    warned.mock.restore();
    for (const [name, was] of kept) {
      if (was === undefined) delete process.env[name];
      else process.env[name] = was;
    }
  }
};

const verdictOn = () => logEntries().filter((one) => one.kind === "verdict").at(-1)?.of ?? null;

test("a flagless verdict from the primary checkout lands on this run's consult taken in a sibling worktree", async () => {
  logged([consult("aaa111", "iss-1-a", SIBLING)]);
  const { refused, said } = await asRun("iss-1-a", () => verdict(["--accepted", "F1"], PRIMARY));
  assert.equal(refused, null);
  assert.equal(verdictOn(), "aaa111");
  assert.match(said, /^recorded against consult aaa111 \(by iss-1-a\) on aaa111\.md$/mu,
    "and the line names the run that wrote the consult it landed on");
});

test("a flagless verdict takes this run's consult over a newer open one another run took in the same checkout", async () => {
  logged([
    consult("mine01", "iss-2-a", PRIMARY, { at: "2026-09-24T00:00:00.000Z" }),
    consult("them01", "iss-2-b", PRIMARY, { at: "2026-09-24T01:00:00.000Z" }),
  ]);
  const { refused } = await asRun("iss-2-a", () => verdict(["--accepted", "F1"], PRIMARY));
  assert.equal(refused, null);
  assert.equal(verdictOn(), "mine01");
});

test("a flagless verdict from a run with no consult here refuses, naming the open one, its run and the form", async () => {
  logged([consult("them02", "iss-3-b", SIBLING)]);
  const { refused } = await asRun("iss-3-a", () => verdict(["--accepted", "F1"], PRIMARY));
  assert.match(refused, /no consult by this run \(iss-3-a\) has answered in this repository/u);
  assert.match(refused, /the open one, them02 on them02\.md, was written by iss-3-b/u);
  assert.match(refused, /`forge codex verdict --of them02 --accepted <ids> --rejected <id>=<why>`/u);
  assert.equal(verdictOn(), null, "and nothing is written");
});

test("--of reaches a consult another run took in a sibling worktree of the same repository", async () => {
  logged([consult("sib001", "iss-4-b", SIBLING), consult("pri001", "iss-4-a", PRIMARY)]);
  const { refused, said } = await asRun("iss-4-a", () => verdict(["--of", "sib001", "--accepted", "F1"], PRIMARY));
  assert.equal(refused, null);
  assert.equal(verdictOn(), "sib001");
  assert.match(said, /consult sib001 \(by iss-4-b\)/u);
});

test("--of for an id answered only in another repository refuses, naming the checkout it answered in", async () => {
  logged([consult("far001", "iss-5-a", STRANGER)]);
  const { refused } = await asRun("iss-5-a", () => verdict(["--of", "far001", "--accepted", "F1"], PRIMARY));
  assert.equal(refused, `codex: consult far001 is out of this repository's reach (${PRIMARY}); `
    + `it answered in ${STRANGER}, of the repository ${STRANGER}.`);
  assert.equal(verdictOn(), null);
});

test("--of for an id the log holds nowhere says so, naming the log it searched", async () => {
  logged([consult("pri002", "iss-6-a", PRIMARY)]);
  const { refused } = await asRun("iss-6-a", () => verdict(["--of", "nope00", "--accepted", "F1"], SIBLING));
  assert.equal(refused, `codex: no answered consult in ${logPath()} carries the id nope00; `
    + "`forge codex log --last 10` lists the ones it holds.");
});

test("a row from before rows carried a repository answers by its checkout path alone", async () => {
  const old = consult("old001", "iss-7-a", SIBLING, { repo: null });
  logged([old]);
  const away = await asRun("iss-7-a", () => verdict(["--of", "old001", "--accepted", "F1"], PRIMARY));
  assert.equal(away.refused, `codex: consult old001 is out of this repository's reach (${PRIMARY}); it answered in `
    + `${SIBLING}, logged before a consult carried its repository, so reached from that checkout alone: \`cd ${SIBLING}\` `
    + "and send it there.", "from the primary checkout, a pre-field worktree row is the stated gap, and the refusal says so");
  const there = await asRun("iss-7-a", () => verdict(["--of", "old001", "--accepted", "F1"], SIBLING));
  assert.equal(there.refused, null, "and from the worktree it was taken in, it is found as before");
  logged([consult("old002", "iss-7-a", PRIMARY, { repo: null })]);
  const fromSibling = await asRun("iss-7-a", () => verdict(["--accepted", "F1"], SIBLING));
  assert.equal(fromSibling.refused, null, "a pre-field row from the primary checkout is the repository's own path");
  assert.equal(verdictOn(), "old002");
});

test("a review capture from a sibling worktree names this run's consult and the verdict it owes", async () => {
  logged([
    consult("mine03", "iss-8-a", PRIMARY, { at: "2026-09-24T00:00:00.000Z" }),
    consult("them03", "iss-8-b", SIBLING, { at: "2026-09-24T01:00:00.000Z" }),
  ]);
  const was = process.cwd();
  process.chdir(siblingAt);
  let patch = null;
  try {
    await asRun("iss-8-a", async () => {
      patch = await patchFrom({ review: true });
    });
  } finally {
    process.chdir(was);
  }
  assert.equal(patch?.review?.consult, "mine03");
  assert.match(patch.review.owed, /^verdict owed on F1 of consult mine03 — forge codex verdict --of mine03 /u);
});

test("a stats window over a named checkout counts the consults of every worktree of its repository", () => {
  const rows = [
    consult("pri004", "a", PRIMARY),
    consult("sib004", "b", SIBLING),
    consult("far004", "c", STRANGER),
  ];
  assert.deepEqual(windowOf(rows, { root: PRIMARY }).map((one) => one.id), ["pri004", "sib004"]);
  assert.deepEqual(windowOf(rows, { root: SIBLING }).map((one) => one.id), ["pri004", "sib004"]);
  rmSync(logPath(), { force: true });
});
