/* The gate is a decision, so it is exercised the way Claude Code calls it: the event on stdin and
   the permission decision on stdout. The config directory is this suite's own and holds no
   credential, which is also what proves the gate asks the tracker nothing. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { callHook, tempRoom } from "../fixtures.mjs";
import { assertRouteFirst } from "../fixtures/route-first.mjs";
import { namesPath } from "../../src/flow/record/merged.mjs";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HOOK = join(PLUGIN, "hooks", "entries", "plan-scope.mjs");

const room = tempRoom("plan-scope-gate-");
const ENV = { ...process.env, XDG_CONFIG_HOME: join(room, "config"), TMPDIR: join(room, "tmp") };
mkdirSync(ENV.TMPDIR, { recursive: true });
delete ENV.FORGE_URL;
delete ENV.FORGE_TOKEN;

/* A real repository, since the gate makes a path repository-relative before it compares it, and the
   directory case needs a directory that is really there. */
const tree = (() => {
  const at = tempRoom("plan-scope-tree-");
  execFileSync("git", ["init", "-q", at], { cwd: dirname(at) });
  mkdirSync(join(at, "plugin", "src"), { recursive: true });
  mkdirSync(join(at, "elsewhere"), { recursive: true });
  mkdirSync(join(at, "plugin", "src", "held.dir"), { recursive: true });
  for (const one of ["planned.mjs", "unplanned.mjs"]) writeFileSync(join(at, "plugin", "src", one), "");
  return realpathSync(at);
})();

const PLAN = "## Files touched\n- `plugin/src/planned.mjs` — the one file this change opens.\n";

const scope = async (rows) => {
  const { dropScope, noteScope } = await import("../../src/flow/record/plan-scope.mjs");
  process.env.XDG_CONFIG_HOME = ENV.XDG_CONFIG_HOME;
  for (const one of await held()) dropScope(one.ref, { tree: one.tree });
  for (const [ref, named, at] of rows) noteScope(ref, named, { tree: at ?? tree });
};

const held = async () => {
  const { scopeHeld } = await import("../../src/flow/record/plan-scope.mjs");
  process.env.XDG_CONFIG_HOME = ENV.XDG_CONFIG_HOME;
  return [...scopeHeld(tree).map((one) => ({ ...one, tree })),
    ...scopeHeld(`${tree}/other`).map((one) => ({ ...one, tree: `${tree}/other` }))];
};

const answered = (run) => {
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true, reason: "" };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason ?? "" };
};

const ask = (event) => answered(callHook(HOOK, { session_id: randomUUID(), cwd: tree, ...event }, ENV));
const writes = (path) => ask({ tool_name: "Write", tool_input: { file_path: join(tree, path) } });
const runs = (command) => ask({ tool_name: "Bash", tool_input: { command } });

test("a write the plan does not name is refused, naming the path, the issue and the correction", async () => {
  await scope([["ISS-411", PLAN]]);
  const held = writes("plugin/src/unplanned.mjs");
  assert.equal(held.allowed, false);
  assert.match(held.reason, /`plugin\/src\/unplanned\.mjs`/u);
  assert.match(held.reason, /ISS-411's plan/u);
  assert.match(held.reason, /forge record correction ISS-411 --corrects plan --moved "the change also wrote plugin\/src\/unplanned\.mjs"/u);
  assert.match(held.reason, /forge hooks --how plan-scope/u);
});

test("a write the plan names, and one a correction names, both pass", async () => {
  await scope([["ISS-411", PLAN]]);
  assert.equal(writes("plugin/src/planned.mjs").allowed, true);
  await scope([["ISS-411", `${PLAN}\nmoved: the change also wrote plugin/src/unplanned.mjs\n`]]);
  assert.equal(writes("plugin/src/unplanned.mjs").allowed, true);
});

test("the gate and the check at developed hold one path outside the plan and never two", async () => {
  await scope([["ISS-411", PLAN]]);
  const paths = ["plugin/src/planned.mjs", "plugin/src/unplanned.mjs", "plugin/src/planned.mjs.bak",
    "plugin/src/sub/planned.mjs", "elsewhere/planned.mjs"];
  for (const one of paths) {
    assert.equal(writes(one).allowed, namesPath(PLAN, one), `the two readings disagree about ${one}`);
  }
});

test("a shell write outside the plan is refused and the file that command reads is not", async () => {
  await scope([["ISS-411", PLAN]]);
  assert.equal(runs("sed -i s/a/b/ plugin/src/unplanned.mjs").allowed, false);
  assert.equal(runs("cp plugin/src/unplanned.mjs plugin/src/planned.mjs").allowed, true);
  assert.equal(runs("grep -n x plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("cp -v plugin/src/unplanned.mjs plugin/src/planned.mjs").allowed, true);
  assert.equal(runs("cp -v plugin/src/planned.mjs plugin/src/unplanned.mjs").allowed, false);
});

test("a write the command placed in no tree is refused for no path", async () => {
  await scope([["ISS-411", PLAN]]);
  assert.equal(runs("cd - && touch plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("touch plugin/src/unplanned.mjs").allowed, false);
});

test("a command this cannot aim, and one aimed at a directory, are refused for no path", async () => {
  await scope([["ISS-411", PLAN]]);
  assert.equal(runs("cat plugin/src/unplanned.mjs | xargs -I{} touch {}").allowed, true);
  assert.equal(runs("cp -t elsewhere plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("cp --target-directory elsewhere plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("cp --target-directory=elsewhere plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("cp -telsewhere plugin/src/planned.mjs plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("cp -vtelsewhere plugin/src/planned.mjs plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("cp plugin/src/planned.mjs plugin/src/held.dir").allowed, true);
});

test("a tree holding no issue, and one whose issue holds no plan, refuse nothing", async () => {
  await scope([]);
  assert.equal(writes("plugin/src/unplanned.mjs").allowed, true);
  await scope([["ISS-411", ""]]);
  assert.equal(writes("plugin/src/unplanned.mjs").allowed, true);
  await scope([["ISS-411", PLAN], ["ISS-412", ""]]);
  assert.equal(writes("plugin/src/unplanned.mjs").allowed, true);
});

test("where a tree holds two plans, a path either one names passes and a path neither names is refused", async () => {
  await scope([["ISS-411", PLAN], ["ISS-412", "- `plugin/src/unplanned.mjs`\n"]]);
  assert.equal(writes("plugin/src/planned.mjs").allowed, true);
  assert.equal(writes("plugin/src/unplanned.mjs").allowed, true);
  assert.equal(writes("plugin/src/third.mjs").allowed, false);
});

test("a write in another repository is judged against that tree's scope and not this one's", async () => {
  await scope([["ISS-411", PLAN]]);
  const away = tempRoom("plan-scope-away-");
  execFileSync("git", ["init", "-q", away], { cwd: dirname(away) });
  assert.equal(ask({ tool_name: "Write", tool_input: { file_path: join(realpathSync(away), "anything.mjs") } }).allowed, true);
});

/* A credential pointed at a closed port: a gate that asked the tracker anything would stand down
   with its own reason, as the gate last on this line does. Both decisions still come, so it asks
   nothing. */
test("the gate decides with the tracker unreachable, so it asks the tracker nothing", async () => {
  await scope([["ISS-411", PLAN]]);
  mkdirSync(join(ENV.XDG_CONFIG_HOME, "forge"), { recursive: true });
  writeFileSync(join(ENV.XDG_CONFIG_HOME, "forge", "config.json"),
    JSON.stringify({ url: "http://127.0.0.1:1/mcp", token: "t", retrySeconds: 0 }));
  assert.equal(writes("plugin/src/unplanned.mjs").allowed, false);
  assert.equal(writes("plugin/src/planned.mjs").allowed, true);
});

/* AC-07-3-4. One refusal: the correction is the route and the path outside the plan comes after it. */
test("every refusal this gate writes leads with its route", async () => {
  await scope([["ISS-411", PLAN]]);
  const said = writes("plugin/src/unplanned.mjs");
  assert.match(said.reason, /^Hold — post the correction, then re-send\.\n {2}forge record correction/u);
  assertRouteFirst(said.reason, "a write outside the plan");
});

/* ISS-2445: a `>` in the source a heredoc feeds an interpreter is that program's, and a refusal for
   the word after it names a file nothing wrote; a redirect on the heredoc's own line still writes. */
test("a > in an interpreter's heredoc body is no write, and a redirect on its own line is one", async () => {
  await scope([["ISS-411", PLAN]]);
  const body = ["if n > buf.len():", "    pass", "PY"].join("\n");
  assert.equal(runs(`cd plugin/src && python3 - <<'PY'\n${body}`).allowed, true);
  const held = runs(`cd plugin/src && python3 - <<'PY' > unplanned.mjs\n${body}`);
  assert.equal(held.allowed, false);
  assert.match(held.reason, /`plugin\/src\/unplanned\.mjs` is outside ISS-411's plan/u);
});

/* ISS-2010: a body writes through its own file calls, each at the argument its API writes, and a
   body that only assigns names nothing; a read operand beside the write is no refusal either. */
test("a file call in an interpreter's heredoc is refused outside the plan, at the argument it writes", async () => {
  await scope([["ISS-411", PLAN]]);
  const py = (...lines) => `cd plugin/src && python3 - <<'PY'\n${lines.join("\n")}\nPY`;
  const node = (line) => `cd plugin/src && node - <<'JS'\n${line}\nJS`;
  for (const [command, why] of [
    [py("open('unplanned.mjs','w').write(s)"), "open"],
    [py("from pathlib import Path", "Path('unplanned.mjs').write_text(s)"), "write_text"],
    [py("p = 'unplanned.mjs'", "open(p, 'w')"), "a bound name"],
    [py("shutil.copy('planned.mjs', 'unplanned.mjs')"), "a copy's destination"],
    [py("shutil.move('unplanned.mjs', 'planned.mjs')"), "a move's source"],
    [py("os.replace('planned.mjs', 'unplanned.mjs')"), "a replace's destination"],
    [py("os.rename('unplanned.mjs', 'planned.mjs')"), "a rename's source, which it takes away"],
    [py("os.rename('planned.mjs', 'unplanned.mjs')"), "a rename's destination"],
    [node("require('fs').writeFileSync('unplanned.mjs', 'x')"), "writeFileSync"],
    [`cd plugin/src && python3 -c "open('unplanned.mjs','w')"`, "an inline body"],
  ]) {
    const held = runs(command);
    assert.equal(held.allowed, false, why);
    assert.match(held.reason, /`plugin\/src\/unplanned\.mjs` is outside ISS-411's plan/u, why);
  }
  assert.equal(runs(py("shutil.copy('unplanned.mjs', 'planned.mjs')")).allowed, true, "a copy's source is only read");
  assert.equal(runs(py("open('planned.mjs','w').write(open('unplanned.mjs').read())")).allowed, true, "an open that reads");
  assert.equal(runs(py("open(os.path.join(base, 'unplanned.mjs'), 'w')")).allowed, true, "a target the program computes");
  assert.equal(runs(py("pick('unplanned.mjs').write_text('x')")).allowed, true, "a receiver another call returns");
  assert.equal(runs(py("n=re.search('a', b)", "s=s.replace('x', 'y')")).allowed, true, "assignments name nothing");
});

/* ISS-3038: nothing a body leaves open in shell terms reaches the redirect after the heredoc. */
test("a write after an interpreter's heredoc is refused whatever its body left open", async () => {
  await scope([["ISS-411", PLAN]]);
  for (const line of ["x = [[1], [2] ]", "s = '''don't'''"]) {
    assert.equal(runs(`python3 - <<'PY'\n${line}\nPY\necho x > plugin/src/unplanned.mjs`).allowed, false, line);
  }
});

/* ISS-2928: a shell reads a heredoc on its stdin as its program, whichever word names it, so a write there is one the plan answers for. */
test("a write in a heredoc a shell reads is refused outside the plan, whatever word names the shell", async () => {
  await scope([["ISS-411", PLAN]]);
  for (const shell of ["bash", "/bin/bash", "dash", "ash"]) {
    assert.equal(runs(`${shell} <<'EOF'\necho x > plugin/src/unplanned.mjs\nEOF`).allowed, false, shell);
  }
});

/* ISS-2766: a shell fixture moves into a directory it made and writes there. On its own line that
   move leaves the shell in the call's cwd only where it failed, so the write is placed nowhere this
   can read, as it is behind `&&`; a move the text spells still leaves the call's own tree a candidate. */
test("a write after a cd this cannot follow is refused for no path on its own line too", async () => {
  await scope([["ISS-411", PLAN]]);
  const fixture = `cd "$(mktemp -d)"\necho x > plugin/src/unplanned.mjs`;
  assert.equal(runs(fixture).allowed, true);
  assert.equal(runs(`bash <<'EOF'\n${fixture}\nEOF`).allowed, true);
  assert.equal(runs(`bash <<EOF\n${fixture}\nEOF`).allowed, true);
});

test("a write after a cd the text spells, on its own line, is still refused in the call's own tree", async () => {
  await scope([["ISS-411", PLAN]]);
  const away = tempRoom("plan-scope-cd-");
  const moved = runs(`cd ${away}\necho x > plugin/src/unplanned.mjs`);
  assert.equal(moved.allowed, false);
  assert.match(moved.reason, /`plugin\/src\/unplanned\.mjs` is outside ISS-411's plan/u);
  const stayed = runs("echo x > plugin/src/unplanned.mjs");
  assert.equal(stayed.allowed, false);
  assert.match(stayed.reason, /`plugin\/src\/unplanned\.mjs` is outside ISS-411's plan/u);
});

/* ISS-2427: a revision range a read-only stage takes after a flag is read, and a refusal naming it
   asks for a correction naming a path nothing wrote; the `tee` target beside it is still judged. */
test("a read-only stage piped into tee is refused only for the tee's own target", async () => {
  await scope([["ISS-411", PLAN]]);
  const away = join(ENV.TMPDIR, "files.txt");
  assert.equal(runs(`git diff --name-only origin/main...HEAD | tee ${away} | wc -l`).allowed, true);
  const held = runs("git diff --name-only origin/main...HEAD | tee plugin/src/unplanned.mjs");
  assert.equal(held.allowed, false);
  assert.match(held.reason, /`plugin\/src\/unplanned\.mjs` is outside ISS-411's plan/u);
  assert.doesNotMatch(held.reason, /origin\/main/u);
});
