/* Which tree a subagent's stop is judged in: the one its last shell call left it in, read by the
   shell reading every gate shares, else the event's cwd (ISS-545). Every case after the first stands
   two linked worktrees with a tracked change each, the event's own and the one the turn's command
   names, so the tree the dirty-tree line names is the tree the gate judged. A shape whose destination
   the text does not carry is judged where the event stood, never at a path built from half of it. */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { cleanRepo, escaped, pathed, tempRoom, typed } from "../../fixtures.mjs";
import { git, handed, room, stopped, subagentStop, used } from "./fixture.mjs";

test("the tree a subagent stood in is the one its commands moved to, whatever the event's cwd says", () => {
  const checkout = cleanRepo();
  writeFileSync(join(checkout, "one.txt"), "committed\n");
  git(checkout, "add", "one.txt");
  git(checkout, "commit", "-qm", "base");
  const wt = join(tempRoom("stop-check-agent-wt-"), "wt");
  assert.equal(git(checkout, "worktree", "add", "-q", "-b", "side", wt).status, 0);
  writeFileSync(join(wt, "one.txt"), "changed, and never committed\n");
  /* One command per line, as a run types them; the `cd` not first, and a second `cd` relative to it. */
  mkdirSync(join(wt, "sub"));
  const own = handed(used("Bash", { command: `export FORGE_SESSION_ID=iss-1-abc\ncd ${pathed(wt)}\ncd sub && git status --short` }));
  const said = stopped(room(), subagentStop({ agent_transcript_path: own, cwd: checkout }));
  assert.match(said?.reason ?? "", /is a worktree/u, said?.reason);
  assert.match(said.reason, new RegExp(`git -C ${escaped(typed(wt))} add -u`, "u"),
    "the worktree, not the checkout the event names");
  /* ISS-1717: a body is the stdin of the command it stands on, and a `cd` it spells moves nothing. */
  const bodied = handed(used("Bash", { command: `cd ${pathed(wt)}
cat > /tmp/b.md <<'X'
cd /no-such-tree
X` }));
  assert.match(stopped(room(), subagentStop({ agent_transcript_path: bodied, cwd: checkout }))?.reason ?? "",
    new RegExp(`git -C ${escaped(typed(wt))} add -u`, "u"), "a cd inside a here-document body");
  /* A space escaped rather than quoted is one word to the shell, and to the reading every gate shares. */
  const spaced = join(tempRoom("stop-check-agent-sp-"), "w t");
  assert.equal(git(checkout, "worktree", "add", "-q", "-b", "spaced", spaced).status, 0);
  writeFileSync(join(spaced, "one.txt"), "changed here too\n");
  const escapedCd = handed(used("Bash", { command: `cd ${spaced.replaceAll(" ", "\\ ")} && git status --short` }));
  assert.match(stopped(room(), subagentStop({ agent_transcript_path: escapedCd, cwd: checkout }))?.reason ?? "",
    new RegExp(`git -C ${escaped(typed(spaced))} add -u`, "u"), "a cd to a path with an escaped space");
});

const twoTrees = (into = tempRoom("stop-check-tree-")) => {
  const checkout = cleanRepo();
  writeFileSync(join(checkout, "one.txt"), "committed\n");
  git(checkout, "add", "one.txt");
  git(checkout, "commit", "-qm", "base");
  const dirty = (name) => {
    const at = join(into, name);
    assert.equal(git(checkout, "worktree", "add", "-q", "-b", `${name}-${randomUUID().slice(0, 8)}`, at).status, 0);
    writeFileSync(join(at, "one.txt"), `changed in ${name}\n`);
    return at;
  };
  return { here: dirty("here"), there: dirty("there") };
};

/* The dirty-tree line of the stop a subagent's one shell call ends in, the event standing in `cwd`. */
const judgedIn = (command, cwd, env = room()) =>
  stopped(env, subagentStop({ agent_transcript_path: handed(used("Bash", { command })), cwd }))?.reason ?? "";

const assertJudgedIn = (reason, tree, other, shape) => {
  assert.match(reason, new RegExp(`git -C ${escaped(typed(tree))} add -u`, "u"), `${shape}: ${reason || "(silent)"}`);
  assert.doesNotMatch(reason, new RegExp(`git -C ${escaped(typed(other))} add -u`, "u"), `${shape}: ${reason}`);
};

test("a cd - after a move is judged where the event stood, not in a directory named -", () => {
  const { here, there } = twoTrees();
  mkdirSync(join(there, "-"));
  assertJudgedIn(judgedIn(`cd ${pathed(there)} && cd -`, here), here, there, "cd -");
});

test("a bare cd after a move is judged where the event stood, not where the move before it went", () => {
  const { here, there } = twoTrees();
  assertJudgedIn(judgedIn(`cd ${pathed(there)} && cd; git status --short`, here), here, there, "bare cd");
});

test("a pushd is a move, and the stop is judged in the tree it named", () => {
  const { here, there } = twoTrees();
  assertJudgedIn(judgedIn(`pushd ${pathed(there)} >/dev/null && git status --short`, here), there, here, "pushd");
});

test("a ~ is the home the hook was started with, and the stop is judged in the tree under it", () => {
  const env = room();
  const { here, there } = twoTrees(env.HOME);
  assertJudgedIn(judgedIn("cd ~/there && git status --short", here, env), there, here, "~");
});

test("a move to a $-bearing path is judged where the event stood, even where that spelling is a directory", () => {
  const { here, there } = twoTrees();
  mkdirSync(join(there, "$SUB"));
  assertJudgedIn(judgedIn(`cd ${pathed(there)} && cd "$SUB"`, here), here, there, "$-bearing path");
});

test("a cd in a pipeline stage moves no shell, and the stop is judged where the event stood", () => {
  const { here, there } = twoTrees();
  assertJudgedIn(judgedIn(`cd ${pathed(there)} 2>&1 | tail -1`, here), here, there, "cd in a pipeline stage");
});
