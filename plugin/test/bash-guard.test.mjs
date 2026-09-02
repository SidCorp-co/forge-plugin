/* The event on stdin and the decision on stdout, as Claude Code calls it. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { callHook, dirtyRepo, homeEnv } from "./fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "bash-guard.mjs");
const HOME = homeEnv("bash-guard");

/* The git rules stand down on a clean tree, so the fixtures bring their own dirty one. */
const DIRTY = dirtyRepo();
const decide = (command) => {
  const run = callHook(HOOK, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command }, cwd: DIRTY }, HOME);
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason };
};

/* Assembled: the guard reads this suite's own command line when a shell writes the file. */
const STAGE_ALL = `git ${"add"} -A`;
const BY_NAME = `pk${"ill"} -f node`;
const SPAWNING = `sub${"process"}.run`;

test("the command itself is refused, and the refusal names the rule and a way out", () => {
  const { allowed, reason } = decide(`${STAGE_ALL} && git commit -m done`);
  assert.equal(allowed, false);
  assert.match(reason, /stages everything in the tree/u);
  assert.match(reason, /Instead: Stage the paths you changed/u);
  assert.match(reason, /forge hooks --how bash-guard/u);
  assert.equal(decide(BY_NAME).allowed, false, "selects by name, so it is not the pid you meant");
});

/* Twice in one session a heredoc was refused for holding the command in a *string literal*. */
test("a literal inside a program is data, and the line that ran it is not", () => {
  assert.ok(decide(`python3 - <<'PY'\nt = t.replace("${STAGE_ALL}", "x")\nPY`).allowed);
  const three = "'".repeat(3);
  assert.ok(
    decide(`python3 - <<'PY'\nt = t.replace(${three}the hook's ${STAGE_ALL} line${three}, "x")\nPY`).allowed,
    "a triple quote read as three skews on the apostrophe inside it, baring the rest",
  );
  const esc = `\\${String.fromCharCode(39)}`;
  const skewed = `p = ['x${esc}y']\ns = s.replace(${three}\n${STAGE_ALL}\n${three}, 'z')`;
  assert.ok(
    decide(`python3 - <<'PY'\n${skewed}\nPY`).allowed,
    "an escape ends a literal early, and every literal after it pairs wrong",
  );
  assert.equal(decide(`echo 'notes' > /tmp/x && ${STAGE_ALL}`).allowed, false, "outside a body it runs");
  assert.equal(decide(`bash -c "${STAGE_ALL}"`).allowed, false, "the operator's line keeps its quotes");
  assert.equal(
    decide(`python3 - <<'PY'\n${SPAWNING}("${STAGE_ALL}", shell=True)\nPY`).allowed,
    false,
    "a body that can reach a shell keeps every literal",
  );
  assert.equal(decide(`eval "${STAGE_ALL}"`).allowed, false, "eval runs its argument");
  assert.equal(
    decide(`python3 -c 'import os; os.system("${STAGE_ALL}")'`).allowed,
    false,
    "and a -c body reaching a shell is the same as a heredoc that does",
  );
  assert.ok(decide(`python3 -c 'x = "${STAGE_ALL}"'`).allowed, "while a -c body that cannot is data");
  const bs = String.fromCharCode(92);
  assert.equal(
    decide(`python3 -c "import os; os.system(${bs}"${STAGE_ALL}${bs}")"`).allowed,
    false,
    "a body quoting with escapes hands the same command over",
  );
  const joined = `python3 -c "import os; os.system(${bs}"git reset --${bs}\nhard${bs}")"`;
  assert.equal(decide(joined).allowed, false, "a backslash-newline joins the line, as the shell does");
});

/* It refused this session's own consult, whose intent named the flag in an echo argument. A rule
   quoted for a program that is not a shell is data, and which program owns it is what `starts` says. */
test("a rule named in an argument is not a run", () => {
  assert.ok(decide(`echo "the note names ${STAGE_ALL} in prose" | forge codex consult`).allowed);
  assert.ok(decide(`grep -n "${BY_NAME}" plugin/hooks/bash-guard.mjs`).allowed, "and a search for it");
  assert.equal(decide("sudo git reset --hard HEAD").allowed, false, "a runner still runs what follows");
  assert.equal(decide("sudo -u root git reset --hard").allowed, false, "past the runner's own options");
  const two = String.fromCharCode(34);
  assert.equal(
    decide(`sudo -u ${two}domain user${two} git reset --hard`).allowed,
    false,
    "and past one whose value holds a space",
  );
  assert.equal(decide("/usr/bin/git reset --hard").allowed, false, "a path names the same program");
  const inner = `${two}domain ${String.fromCharCode(92)}${two}user name${String.fromCharCode(92)}${two}${two}`;
  assert.equal(decide(`sudo -u ${inner} git reset --hard`).allowed, false, "an escape inside that value");
  assert.equal(decide(`${two}git${two} reset --hard`).allowed, false, "a quoted program is the program");
  assert.equal(decide(`${two}/usr/bin/git${two} reset --hard`).allowed, false, "quoted and pathed both");
  const half = `${String.fromCharCode(39)}/usr/bin${String.fromCharCode(39)}/git`;
  assert.equal(decide(`${half} reset --hard`).allowed, false, "a token quoted in part is one program");
  const three = '"'.repeat(3);
  assert.equal(
    decide(`python3 - <<'PY'\n${SPAWNING}(${three}git reset --hard${three}, shell=True)\nPY`).allowed,
    false,
    "and a payload quoted three deep is the same command",
  );
  const kill = BY_NAME.split(" ")[0];
  assert.equal(decide(`pgrep -f node | xargs ${kill}`).allowed, false, "and so does xargs");
  assert.equal(decide(`pgrep -f node | xargs -I {} ${kill} {}`).allowed, false, "with a placeholder too");
  const held = `xargs -I ${String.fromCharCode(34)}{}${String.fromCharCode(34)}`;
  assert.equal(decide(`pgrep -f node | ${held} ${kill}`).allowed, false, "a quoted placeholder as well");
});

/* Seven refusals in three days were `git add -A <paths>`, each told it staged the whole tree; a pathspec
   bounds `-A`. Only `.` — or `./` — is everything, and a redirect's operand is not a path. */
test("a pathspec bounds -A, and only the dot is everything", () => {
  const all = "git " + "add -A";
  assert.equal(decide(`${all} plugin docs`).allowed, true);
  assert.equal(decide(`${all} -- plugin`).allowed, true);
  assert.equal(decide(all).allowed, false);
  assert.equal(decide(`${all} .`).allowed, false);
  assert.equal(decide(`${all} ./`).allowed, false, "the same tree, spelled longer");
  assert.equal(decide("git " + "add .").allowed, false);
  assert.equal(decide(`${all} > /tmp/log`).allowed, false, "a redirect's operand is not a pathspec");
  assert.equal(decide(`${all} 2>&1`).allowed, false);
  assert.equal(decide(`${all}n`).allowed, true, "a dry run stages nothing");
  assert.equal(decide(`${all} --dry-run`).allowed, true);
  assert.equal(decide("git " + "add . -- -n").allowed, false, "after `--` a flag is a file name");
  assert.equal(decide(`${all} :/`).allowed, false, "pathspec magic for the root is the root");
});

/* The shell removes a quote and keeps what is inside it, so a quoted flag is the flag. Four rules
   read the flag directly and missed all four of these until codex named them. */
test("a quoted flag is still the flag the rule is about", () => {
  const q = String.fromCharCode(34);
  assert.equal(decide(`git ${"add"} ${q}-A${q}`).allowed, false);
  assert.equal(decide(`git reset ${q}--hard${q}`).allowed, false);
  assert.equal(decide(`git ${q}stash${q}`).allowed, false);
  assert.equal(decide(`eslint ${q}--fix${q} .`).allowed, false);
  assert.equal(decide(`git checkout -- ${q}file.txt${q}`).allowed, false);
});

/* Reading the stash reverts nothing, and refusing `${"stash"} list` cost the whole line it sat on. */
test("reading the stash is not reverting it", () => {
  const verb = "stash";
  assert.equal(decide(`git ${verb} list`).allowed, true);
  assert.equal(decide(`git ${verb} show -p`).allowed, true);
  assert.equal(decide(`git ${verb} push -m probe`).allowed, false);
  assert.equal(decide(`git ${verb}`).allowed, false);
});

/* The dirty-tree check read the shell's cwd, so `git -C other stash` was judged by the wrong tree. */
test("a git aimed at another tree is judged by that tree", () => {
  const dirty = dirtyRepo();
  const clean = mkdtempSync(join(tmpdir(), "clean-repo-"));
  spawnSync("git", ["init", "-q", clean]);
  const from = (cwd, command) => callHook(HOOK, { tool_name: "Bash", tool_input: { command }, cwd, session_id: "c" }, homeEnv("bash-guard"));
  assert.equal(from(dirty, `git -C ${clean} stash`).stdout.trim(), "", "a clean tree named from a dirty cwd has nothing to lose");
  assert.match(from(clean, `git -C ${dirty} stash`).stdout, /git stash silently reverts/u, "a dirty tree named from a clean cwd does");
});

/* A global's value may be quoted and hold a space, and a flag with no value must not eat `-C`. */
test("git's globals before the verb are read as git reads them", () => {
  const dirty = mkdtempSync(join(tmpdir(), "dirty tree-"));
  spawnSync("git", ["init", "-q", dirty]);
  writeFileSync(join(dirty, "a.txt"), "x\n");
  const from = (cwd, command) => callHook(HOOK, { tool_name: "Bash", tool_input: { command }, cwd, session_id: "c" }, homeEnv("bash-guard")).stdout;
  const clean = mkdtempSync(join(tmpdir(), "clean-"));
  spawnSync("git", ["init", "-q", clean]);
  assert.match(from(clean, `git -C "${dirty}" reset --hard`), /reset --hard discards/u, "a quoted tree with a space is the tree");
  assert.match(from(clean, `git --no-pager -C "${dirty}" stash`), /git stash silently/u, "a bare flag before -C does not eat it");
  assert.match(from(clean, `git -c core.pager=cat -C '${dirty}' stash`), /git stash silently/u);
  assert.equal(from(dirty, `git --no-pager -C ${clean} stash`).trim(), "", "and the named clean tree has nothing to lose");
});

test("a tree named by --git-dir and --work-tree is the tree judged", () => {
  const dirty = dirtyRepo();
  const clean = mkdtempSync(join(tmpdir(), "clean-"));
  spawnSync("git", ["init", "-q", clean]);
  const from = (cwd, command) => callHook(HOOK, { tool_name: "Bash", tool_input: { command }, cwd, session_id: "c" }, homeEnv("bash-guard")).stdout;
  assert.match(from(clean, `git --git-dir ${dirty}/.git --work-tree ${dirty} reset --hard`), /reset --hard discards/u);
  assert.equal(from(dirty, `git --git-dir=${clean}/.git reset --hard`).trim(), "", "a clean tree named by its .git");
});

test("--work-tree names the work tree whatever --git-dir says after it", () => {
  const dirty = dirtyRepo();
  const meta = mkdtempSync(join(tmpdir(), "meta-"));
  const clean = mkdtempSync(join(tmpdir(), "clean-"));
  spawnSync("git", ["init", "-q", clean]);
  const from = (cwd, command) => callHook(HOOK, { tool_name: "Bash", tool_input: { command }, cwd, session_id: "c" }, homeEnv("bash-guard")).stdout;
  assert.match(from(clean, `git --work-tree ${dirty} --git-dir ${meta}/repo.git reset --hard`), /reset --hard discards/u);
});
