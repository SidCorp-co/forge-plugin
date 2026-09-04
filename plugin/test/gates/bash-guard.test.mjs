/* The event on stdin and the decision on stdout, as Claude Code calls it. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { movedTo, standsIn } from "../../hooks/_hook.mjs";
import { callHook, dirtyRepo, homeEnv, tempRoom } from "../fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks", "entries", "bash-guard.mjs");
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

/* The same call with the cwd named, for the rules that are judged in a tree rather than in the shell's. */
const from = (cwd, command) =>
  callHook(HOOK, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command }, cwd }, HOME).stdout;

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
  assert.ok(decide(`grep -n "${BY_NAME}" plugin/hooks/entries/bash-guard.mjs`).allowed, "and a search for it");
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
  const clean = tempRoom("clean-repo-");
  spawnSync("git", ["init", "-q", clean]);
  assert.equal(from(dirty, `git -C ${clean} stash`).trim(), "", "a clean tree named from a dirty cwd has nothing to lose");
  assert.match(from(clean, `git -C ${dirty} stash`), /git stash silently reverts/u, "a dirty tree named from a clean cwd does");
});

/* A global's value may be quoted and hold a space, and a flag with no value must not eat `-C`. */
test("git's globals before the verb are read as git reads them", () => {
  const dirty = tempRoom("dirty tree-");
  spawnSync("git", ["init", "-q", dirty]);
  writeFileSync(join(dirty, "a.txt"), "x\n");
  const clean = tempRoom("clean-");
  spawnSync("git", ["init", "-q", clean]);
  assert.match(from(clean, `git -C "${dirty}" reset --hard`), /reset --hard discards/u, "a quoted tree with a space is the tree");
  assert.match(from(clean, `git --no-pager -C "${dirty}" stash`), /git stash silently/u, "a bare flag before -C does not eat it");
  assert.match(from(clean, `git -c core.pager=cat -C '${dirty}' stash`), /git stash silently/u);
  assert.equal(from(dirty, `git --no-pager -C ${clean} stash`).trim(), "", "and the named clean tree has nothing to lose");
});

test("a tree named by --git-dir and --work-tree is the tree judged", () => {
  const dirty = dirtyRepo();
  const clean = tempRoom("clean-");
  spawnSync("git", ["init", "-q", clean]);
  assert.match(from(clean, `git --git-dir ${dirty}/.git --work-tree ${dirty} reset --hard`), /reset --hard discards/u);
  assert.equal(from(dirty, `git --git-dir=${clean}/.git reset --hard`).trim(), "", "a clean tree named by its .git");
});

/* Every hop but the last was dropped, so `git -C parent -C child reset --hard` was judged by `child`
   from the shell's own cwd — another tree of that name, and a clean one stands the rule down on a
   command that is about to discard work somewhere else. Git composes the hops (ISS-82). */
test("a repeated -C is judged in the tree the hops compose to", () => {
  const parent = tempRoom("parent-");
  const dirty = join(parent, "child");
  spawnSync("git", ["init", "-q", dirty]);
  writeFileSync(join(dirty, "a.txt"), "x\n");
  /* A clean `child` beside the shell, so reading the last hop alone finds a tree with nothing to lose. */
  const beside = tempRoom("beside-");
  spawnSync("git", ["init", "-q", join(beside, "child")]);
  assert.match(from(beside, `git -C ${parent} -C child reset --hard`), /reset --hard discards/u);
  assert.equal(
    from(dirty, `git -C ${parent} -C ${join(beside, "child")} reset --hard`).trim(),
    "",
    "an absolute hop replaces what preceded it",
  );
});

test("--work-tree names the work tree whatever --git-dir says after it", () => {
  const dirty = dirtyRepo();
  const meta = tempRoom("meta-");
  const clean = tempRoom("clean-");
  spawnSync("git", ["init", "-q", clean]);
  assert.match(from(clean, `git --work-tree ${dirty} --git-dir ${meta}/repo.git reset --hard`), /reset --hard discards/u);
});

/* ISS-100: with both given, `-C` lost the rank to `--git-dir`, and a wrong tree that reads clean
   stands the git rules down — so `reset --hard` was allowed against the tree `-C` actually names.
   The discriminating wrong tree is a real, *clean* repository: `treeIsDirty` answers true on any
   error, so a `--git-dir` naming no repository at all was refused before the fix as well. */
test("-C outranks what --git-dir implies, so the tree at stake is the tree judged", () => {
  const dirty = dirtyRepo();
  const clean = tempRoom("clean-");
  spawnSync("git", ["init", "-q", clean]);
  const third = tempRoom("third-");
  spawnSync("git", ["init", "-q", third]);
  assert.match(from(third, `git -C ${dirty} --git-dir ${clean}/.git reset --hard`), /reset --hard discards/u);
  assert.equal(
    from(third, `git -C ${clean} --git-dir ${dirty}/.git reset --hard`).trim(),
    "",
    "and the clean tree it names has nothing to lose, so the rank is what answered and not the refusal",
  );
});

/* An agent's shell resets its cwd between calls, so it reaches a worktree by moving there first, and
   every `needsDirtyTree` rule stood down on the tree it started in instead. That is how ISS-82's work
   was destroyed: the push was allowed because the main checkout was clean (ISS-86). `movedTo` is the
   harness's, so this reading and the commit's are one. */
test("a git rule is judged in the tree a preceding cd moved to", () => {
  const verb = "stash";
  const dirty = dirtyRepo();
  const clean = tempRoom("clean-");
  spawnSync("git", ["init", "-q", clean]);
  assert.match(
    from(clean, `cd ${dirty} && git ${verb}`),
    /git stash silently reverts/u,
    "the worktree the call moved to, and not the clean checkout the shell started in",
  );
  assert.equal(
    from(dirty, `cd ${clean} && git reset --hard`).trim(),
    "",
    "and the converse, which is the refusal that teaches an agent the guard is noise",
  );
  assert.match(
    from(clean, `cd ${clean} && git ${verb} ; cd ${dirty} && git ${verb}`),
    /git stash silently reverts/u,
    "a compound stands in two trees, so the one with work at stake answers and not the first",
  );
  assert.equal(
    from(clean, `git ${verb} ; cd ${dirty} && echo done`).trim(),
    "",
    "while a move after the command is not one the command inherited",
  );
});

/* Both of these resolved against the event's cwd, where neither child exists, and `treeIsDirty`
   answers true on any doubt — so the dirty one was refused for the wrong reason and the clean one
   was refused for no reason at all. */
test("a relative -C after a cd resolves against the move, as it does for a commit", () => {
  const verb = "stash";
  const parent = tempRoom("parent-");
  spawnSync("git", ["init", "-q", join(parent, "dirty")]);
  writeFileSync(join(parent, "dirty", "a.txt"), "x\n");
  spawnSync("git", ["init", "-q", join(parent, "clean")]);
  const elsewhere = dirtyRepo();
  assert.match(from(elsewhere, `cd ${parent} && git -C dirty ${verb}`), /git stash silently reverts/u);
  assert.equal(
    from(elsewhere, `cd ${parent} && git -C clean ${verb}`).trim(),
    "",
    "the child the move names is the tree judged, and a clean one has nothing to lose",
  );
  assert.match(
    from(parent, `cd dirty && git ${verb}`),
    /git stash silently reverts/u,
    "and a relative move composes against the cwd the same way",
  );
});

/* The same defect has a second door: a literal an interpreter hands to a shell is read as the command
   it hands over, and that reading was answered from the event's cwd however the outer command moved. */
test("a command inside a body handed to a shell is judged in the tree the outer cd moved to", () => {
  const verb = "stash";
  const dirty = dirtyRepo();
  const clean = tempRoom("clean-");
  spawnSync("git", ["init", "-q", clean]);
  assert.match(
    from(clean, `cd ${dirty} && python3 -c 'import os; os.system("git ${verb}")'`),
    /git stash silently reverts/u,
    "the outer move is the tree, though the command sits in a literal",
  );
  assert.equal(
    from(dirty, `cd ${clean} && python3 -c 'import os; os.system("git reset --hard")'`).trim(),
    "",
    "and it stands down there for the same reason",
  );
});

/* One copy of the reading, in the harness both gates load: a subshell's move dies with it, and two
   relative moves compose. */
test("movedTo is the harness's, and reads only the moves before the point asked about", () => {
  const text = "cd /one && cd two && git status";
  assert.equal(movedTo(text, text.indexOf("git status")), "/one/two");
  assert.equal(movedTo(text, text.indexOf("&&")), "/one", "and only the moves whose span begins by then");
  assert.equal(movedTo("git status", 0), null, "and nothing moved answers nothing");
  const sub = "(cd /gone && echo x) ; git status";
  assert.equal(movedTo(sub, sub.indexOf("git status")), null, "a subshell's move dies with it");
});

/* Found by the second opinion on this change: reading *any* preceding `cd` as a move is wrong in the
   dangerous direction. A backgrounded or piped `cd` runs in a shell that exits, and one before `||`
   runs only where it failed — the shell that goes on to the command never left, so it is still in the
   tree with work at stake, and a clean tree it never entered would stand the rule down. */
test("a move the command did not inherit is not a move", () => {
  const verb = "stash";
  const dirty = dirtyRepo();
  const clean = tempRoom("clean-");
  spawnSync("git", ["init", "-q", clean]);
  for (const [sep, why] of [
    ["&", "a backgrounded cd leaves the parent where it was"],
    ["|", "and a pipeline stage is its own shell"],
    ["||", "and the far side of || runs only where the cd failed"],
  ]) {
    assert.match(from(dirty, `cd ${clean} ${sep} git ${verb}`), /git stash silently reverts/u, why);
  }
  assert.equal(
    from(dirty, `cd ${clean} && git ${verb}`).trim(),
    "",
    "while && runs the command only where the cd succeeded, so that move is inherited",
  );
  assert.match(
    from(dirty, `(cd ${clean}; true) & git ${verb}`),
    /stash silently reverts/u,
    "a span closing a subshell keeps the cwd the pop gave it back, whatever separator follows",
  );
  assert.match(
    from(dirty, `true | cd ${clean} && git ${verb}`),
    /stash silently reverts/u,
    "and a cd a pipe introduced ran in its own shell, however certain the separator after it looks",
  );
  assert.match(
    from(dirty, `true |& cd ${clean} && git ${verb}`),
    /stash silently reverts/u,
    "including the form that pipes stderr too, which is the pipe spans keeps whole",
  );
  assert.match(
    from(dirty, `true |\n cd ${clean} && git ${verb}`),
    /stash silently reverts/u,
    "and a pipeline continued onto the next line is still one pipeline, so the separator nearest the "
    + "cd is a newline and the pipe that introduced its stage is a span further back",
  );
  const conditional = `cd /gone || cd ${clean} && git ${verb}`;
  assert.deepEqual(
    standsIn(conditional, conditional.indexOf(`git ${verb}`)),
    [clean, "/gone", null],
    "while a cd behind || ran in this shell if it ran at all, so the tree it reaches is live — and "
    + "so is the tree the cd in front of the || reaches, because the reading does not run the shell "
    + "to find out which way the condition went",
  );
  assert.equal(
    from(dirty, `printf 'a' \\| \n cd ${clean} && git ${verb}`).trim(),
    "",
    "and an escaped pipe is a literal the span reader steps over rather than a stage, so the move "
    + "behind it is this shell's and the clean tree it names is the one judged",
  );
  assert.match(
    from(clean, `(cd ${dirty} && git ${verb})`),
    /stash silently reverts/u,
    "while a subshell the command is still inside has not closed yet, so the move it made holds "
    + "for that command however the span it sits in ends",
  );
});

/* Enumerating shapes is what found three of these one at a time, so the rule is the one treeIsDirty
   already states for itself — true on any doubt — carried from "git cannot answer" to "which tree
   cannot be known". `;` runs the command whichever way the `cd` went, so both trees stay live. */
test("where the move is not certain, every tree the call could stand in is judged", () => {
  const verb = "stash";
  const dirty = dirtyRepo();
  const clean = tempRoom("clean-");
  spawnSync("git", ["init", "-q", clean]);
  const doubted = from(dirty, `cd ${clean} ; git ${verb}`);
  assert.match(doubted, /stash silently reverts/u, "the shell may never have left the dirty tree");
  assert.match(doubted, /could run in more than one tree/u, "and the refusal says that is why");
  assert.match(doubted, /Join them with .&&./u, "and names the way to make the tree certain");
  assert.match(
    from(dirty, `cd ${clean} extra ; git ${verb}`),
    /stash silently reverts/u,
    "a cd with too many arguments fails, and doubt covers that without parsing for it",
  );
  assert.doesNotMatch(
    from(clean, `cd ${dirty} && git ${verb}`),
    /could run in more than one tree/u,
    "while a certain move is refused for the tree itself, and is told nothing about doubt",
  );
  assert.match(
    from(dirty, `cd ${clean} && false || git ${verb}`),
    /stash silently reverts/u,
    "a || in front of the command keeps the tree the shell started in live, because the && list "
    + "before it may have failed at a span this reading does not follow, and that branch never moved",
  );
  assert.match(
    from(clean, `cd ${dirty} || true ; git ${verb}`),
    /stash silently reverts/u,
    "and a || after the move rules it out only for the span behind it, which is the one that runs "
    + "where the cd failed — a command past the whole list runs whichever way it went",
  );
});

/* One reading, two shapes: the commit gate needs the single tree every move leads to, and the guard
   needs the set. `movedTo` is the first of the set, so codex-second's 33 cases never saw a signature. */
test("standsIn answers with every tree, and movedTo with the one every move leads to", () => {
  const text = "cd /one && cd two && git status";
  assert.deepEqual(standsIn(text, text.indexOf("git status")), ["/one/two"]);
  assert.equal(movedTo(text, text.indexOf("git status")), "/one/two");
  const doubted = "cd /one ; cd two && git status";
  assert.deepEqual(standsIn(doubted, doubted.indexOf("git status")), ["/one/two", "two"],
    "the second cd is relative, so it composes onto the first move and onto having never moved");
  assert.equal(movedTo(doubted, doubted.indexOf("git status")), "/one/two", "and the first is every move");
  assert.deepEqual(standsIn("git status", 0), [null], "nothing moved is the caller's own cwd");
});
