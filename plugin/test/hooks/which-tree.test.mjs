/* Which tree a command runs in, watched through the guard's own refusals: one reading in the harness,
   and read wrong it is silent in the dangerous direction — a clean checkout stands the git rules down. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { NOWHERE, movedTo, standsIn } from "../../hooks/_hook.mjs";
import { callHook, cleanRepo, dirtyRepo, homeEnv, tempRoom } from "../fixtures.mjs";

const HOOK = new URL("../../hooks/entries/bash-guard.mjs", import.meta.url).pathname;
const HOME = homeEnv("bash-guard-trees");
/* The git rules stand down on a clean tree, so the fixtures bring their own dirty one. */
const DIRTY = dirtyRepo();

/* The call with its cwd named, these rules being judged in a tree rather than in the shell's. */
const from = (cwd, command) =>
  callHook(HOOK, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command }, cwd }, HOME).stdout;

/* A table of shape and the trees it may run in: the set is what the guard reads, so it is asserted
   whole rather than through a refusal that only says one of them had work at stake. */
const reads = (table) => {
  for (const [text, want, why] of table) assert.deepEqual(standsIn(text, text.indexOf("git st")), want, why);
};

test("a tree named by --git-dir and --work-tree is the tree judged", () => {
  const dirty = dirtyRepo();
  const clean = cleanRepo();
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
  const clean = cleanRepo();
  assert.match(from(clean, `git --work-tree ${dirty} --git-dir ${meta}/repo.git reset --hard`), /reset --hard discards/u);
});

/* ISS-100: with both given, `-C` lost the rank to `--git-dir`, and a wrong tree that reads clean
   stands the git rules down — so `reset --hard` was allowed against the tree `-C` actually names.
   The discriminating wrong tree is a real, *clean* repository: `treeIsDirty` answers true on any
   error, so a `--git-dir` naming no repository at all was refused before the fix as well. */
test("-C outranks what --git-dir implies, so the tree at stake is the tree judged", () => {
  const dirty = dirtyRepo();
  const clean = cleanRepo();
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
  const clean = cleanRepo();
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
  const clean = cleanRepo();
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
  const clean = cleanRepo();
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
  const clean = cleanRepo();
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

/* Seven shapes the reading answered with fewer trees than bash could run the command in (ISS-188),
   each one a refusal that silently did not happen: the guard checked a clean tree and stood down while
   the dirty one was where the command landed. The first lives in `spans`, so every gate reading spans
   split a comment's `|` as a pipeline stage too. */
test("a pipe inside a comment is no pipeline, so the move behind it is still this shell's", () => {
  const dirty = dirtyRepo();
  assert.match(
    from(cleanRepo(), `echo x # |\ncd ${dirty} && git ${"stash"}`),
    /stash silently reverts/u,
    "the comment's pipe read as a stage, which suppressed the move, and the clean starting tree answered",
  );
  reads([
    ["echo x # |\ncd /one && git status", ["/one"], "the pipe inside it is text, not a stage"],
    ["cd /one # && \n git status", ["/one", null],
      "and the separator the move is judged by is the newline that ends the comment, not the `&&` in it"],
  ]);
});

test("a span closing two subshells hands back two cwds", () => {
  const verb = "stash";
  const dirty = dirtyRepo();
  const clean = cleanRepo();
  reads([
    ["(cd /one && (cd /two && true)); git status", [null],
      "one frame popped for two closes answered /one, which is a tree the command never stood in"],
  ]);
  assert.equal(
    from(clean, `(cd ${dirty} && (cd ${dirty} && true)) ; git ${verb}`).trim(),
    "",
    "so the command past them runs where the shell started, both subshells having closed",
  );
  assert.match(
    from(clean, `(cd ${dirty} && (cd ${dirty} && git ${verb}))`),
    /stash silently reverts/u,
    "while a command still inside both of them inherits both moves",
  );
});

/* A `pushd` moves this shell exactly as a `cd` does, and it reached the reading only through the copy
   the learning gate kept: three gates read one text, so it belongs here or nowhere (ISS-260). */
test("a pushd is a move, and the stack a popd returns to is a tree nobody named", () => {
  const verb = "stash";
  const dirty = dirtyRepo();
  assert.match(from(cleanRepo(), `pushd ${dirty} && git ${verb}`), /stash silently reverts/u);
  reads([
    ["pushd /one && cd two && git status", ["/one/two"], "and it composes with the moves around it"],
    ["popd && git status", [NOWHERE], "while a popd names no tree this reading can check"],
    ["pushd && git status", [NOWHERE], "nor a pushd with nothing to move to"],
    ["pushd +1 && git status", [NOWHERE], "nor one rotating the stack"],
    ["pushd -n /one && git status", [null], "while a -n moves the stack and leaves the shell where it was"],
    ["popd -n && git status", [null], "so the tree it started in is known, and reading it as unknown lost one"],
    ["cd -- -n && git status", ["-n"], "while past a `--` a word beginning with one is the destination"],
  ]);
  assert.match(
    from(cleanRepo(), `pushd ${dirty} && popd && git ${verb}`),
    /cannot be read from the command/u,
    "so what follows one is treated as having work at stake, and told to spell the directory out",
  );
});

/* `MOVES` allowed only an optional `(` in front of `cd`, so a compound's move was not seen at all. */
test("a cd a compound command runs is this shell's move", () => {
  const verb = "stash";
  const dirty = dirtyRepo();
  const clean = cleanRepo();
  for (const [command, why] of [
    [`if cd ${dirty}; then git ${verb}; fi`, "an if runs its condition in this shell"],
    [`while cd ${dirty}; do git ${verb}; done`, "and so does a while"],
    [`{ cd ${dirty}; git ${verb}; }`, "and a brace group is not a subshell"],
    [`if true; then cd ${dirty}; git ${verb}; fi`, "and a move inside a branch is the shell's as well"],
  ]) {
    assert.match(from(clean, command), /stash silently reverts/u, why);
  }
  assert.doesNotMatch(
    from(clean, `if cd ${dirty}; then git ${verb}; fi`),
    /could run in more than one tree/u,
    "reaching `then` proves the cd exited zero, and the doubt suffix's one action — join with `&&` — "
    + "cannot be written inside an if",
  );
  assert.match(
    from(clean, `{ cd ${dirty}; git ${verb}; }`),
    /could run in more than one tree/u,
    "while a brace group runs the next command whichever way the cd went, and there `&&` is the way out",
  );
  assert.match(
    from(dirty, `! cd ${clean} && git ${verb}`),
    /stash silently reverts/u,
    "and a `!` is not one of them: it inverts, so reaching the command proves the cd failed and the "
    + "shell never left the tree with work in it",
  );
});

/* The destination was one quoted fragment or one unspaced run, so the tree the command ran in was
   absent from the candidates rather than merely uncertain. */
test("a destination spelled in fragments is one shell word", () => {
  const verb = "stash";
  const parent = tempRoom("parent-");
  const clean = cleanRepo();
  for (const name of ["dirty", "dirty tree"]) {
    spawnSync("git", ["init", "-q", join(parent, name)]);
    writeFileSync(join(parent, name, "a.txt"), "x\n");
  }
  assert.match(
    from(clean, `cd "${parent}"/dirty && git ${verb}`),
    /stash silently reverts/u,
    "a quoted fragment and a bare run are one word, and the reading stopped at the closing quote",
  );
  assert.match(
    from(clean, `cd ${parent}/"dirty tree" && git ${verb}`),
    /stash silently reverts/u,
    "and a quoted space is inside the word rather than the end of it",
  );
});

/* `cd -` is `$OLDPWD` and a bare `cd` is `$HOME`: neither destination is in the text, so no regex
   reaches it. Guessing gave `<cwd>/-`, a directory that exists nowhere, refused for the wrong reason
   and with nothing said about why; a bare `cd` was not read as a move at all, so $HOME's own
   repository went unjudged. */
test("a tree the command does not name is one with work at stake, and the refusal says so", () => {
  const verb = "stash";
  const clean = cleanRepo();
  for (const [command, why] of [
    [`cd - && git ${verb}`, "`cd -` is $OLDPWD, which the command's text does not carry"],
    [`cd && git ${verb}`, "and a bare cd is $HOME, which it does not carry either"],
    [`cd $D/x && git ${verb}`, "and a path built from a value is a name nothing here can check"],
  ]) {
    const said = from(clean, command);
    assert.match(said, /stash silently reverts/u, why);
    assert.match(said, /cannot be read from the command/u, "and the refusal says the reading failed");
    assert.match(said, /Spell the directory out/u, "and names what to write instead of it");
  }
  reads([
    ["cd - && git status", [NOWHERE], "the set carries the sentinel"],
    ["cd - && cd sub && git status", [NOWHERE],
      "and a relative move composed onto a tree nobody named names nothing either"],
    ["cd - && cd /one && git status", ["/one"], "while an absolute one needs no base, so doubt ends"],
    ["cd $(pwd) && git status", [NOWHERE],
      "a substitution is a destination the text does not carry, however the shell would expand it"],
  ]);
  const back = "cd - && git status";
  assert.equal(movedTo(back, back.indexOf("git st")), NOWHERE,
    "and movedTo hands the commit gate the same answer, which refuses rather than resolve it (ISS-211)");
});

test("a git rule still stands down where the tree the reading names is clean", () => {
  const verb = "stash";
  const clean = cleanRepo();
  /* Under a plain directory, so the outer name is no repository the inner one could make dirty. */
  const parent = tempRoom("parent-");
  const inner = join(parent, "inner");
  spawnSync("git", ["init", "-q", inner]);
  for (const [command, why] of [
    [`if cd ${clean}; then git ${verb}; fi`, "the compound's move is read, and what it reaches is clean"],
    [`cd "${parent}"/inner && git ${verb}`, "and so is a fragmented destination's"],
    [`(cd ${parent} && (cd ${inner} && git ${verb}))`, "and so are two frames the command is inside"],
  ]) {
    assert.equal(from(DIRTY, command).trim(), "", why);
  }
});

/* Both found by the second opinion on this change, both narrowing in the dangerous direction. A
   substitution's `)` was counted as a close though its `(` opened no frame, so it popped a real
   subshell the command was still inside; and `do` was read as proof the `cd` succeeded after `until`,
   whose body is the one place that runs where it failed. */
test("a substitution closes no frame, and an until inverts what its do proves", () => {
  const verb = "stash";
  const dirty = dirtyRepo();
  const clean = cleanRepo();
  reads([
    ["(cd /dirty && echo $(pwd) && git status)", ["/dirty"],
      "the `)` of `$(pwd)` popped the subshell the command is still inside"],
    ["(echo $(pwd) && cd /clean); git status", [null],
      "while the frame the span really closes is still given back, so a move inside it dies with it"],
  ]);
  assert.match(
    from(clean, `(cd ${dirty} && echo $(pwd) && git ${verb})`),
    /stash silently reverts/u,
    "and the guard is judged in the subshell's tree rather than the clean one it started in",
  );
  assert.match(
    from(dirty, `until cd ${clean}; do git ${verb}; done`),
    /stash silently reverts/u,
    "an until runs its body where the cd failed, so the tree the shell started in is live — and it is "
    + "the one with work at stake, which `then` and `do` proving success would have ruled out",
  );
  assert.match(
    from(clean, `while cd ${dirty}; do git ${verb}; done`),
    /stash silently reverts/u,
    "while a while proves the opposite, its body running only where the cd succeeded",
  );
});
