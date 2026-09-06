/* The event on stdin and the decision on stdout, as Claude Code calls it. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { waitsIn } from "../../src/hooks/shell-spans.mjs";
import { callHook, cleanRepo, dirtyRepo, homeEnv, tempRoom } from "../fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks", "entries", "bash-guard.mjs");
const HOME = homeEnv("bash-guard");

/* The git rules stand down on a clean tree, so the fixtures bring their own dirty one. */
const DIRTY = dirtyRepo();
/* The session travels, because one rule here is about what the call before this one in it did. */
const decideIn = (session, command, tool = "Bash") => {
  const run = callHook(HOOK, { session_id: session, tool_name: tool, tool_input: { command }, cwd: DIRTY }, HOME);
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason };
};

const decide = (command) => decideIn(randomUUID(), command);

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

/* Where the tree at stake is not the shell's, the cwd is the event's rather than this suite's dirty one. */
const from = (cwd, command) =>
  callHook(HOOK, { session_id: randomUUID(), tool_name: "Bash", tool_input: { command }, cwd }, HOME).stdout;

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
  const clean = cleanRepo();
  assert.match(from(clean, `git -C "${dirty}" reset --hard`), /reset --hard discards/u, "a quoted tree with a space is the tree");
  assert.match(from(clean, `git --no-pager -C "${dirty}" stash`), /git stash silently/u, "a bare flag before -C does not eat it");
  assert.match(from(clean, `git -c core.pager=cat -C '${dirty}' stash`), /git stash silently/u);
  assert.equal(from(dirty, `git --no-pager -C ${clean} stash`).trim(), "", "and the named clean tree has nothing to lose");
});

/* Reading the stash reverts nothing, and refusing `${"stash"} list` cost the whole line it sat on. */
test("reading the stash is not reverting it", () => {
  const verb = "stash";
  assert.equal(decide(`git ${verb} list`).allowed, true);
  assert.equal(decide(`git ${verb} show -p`).allowed, true);
  assert.equal(decide(`git ${verb} push -m probe`).allowed, false);
  assert.equal(decide(`git ${verb}`).allowed, false);
});

/* One token elsewhere in a body turned every literal in it into a command: the escape names were one
   pattern for every language, and a python heredoc appending JavaScript test cases was refused for a
   verb inside its data, because that data also said `spawnSync` — which python cannot call (ISS-212). */
test("an escape another language has is data in a body that cannot call it", () => {
  const verb = "stash";
  const three = "'".repeat(3);
  const NODE_ESCAPE = `spawn${"Sync"}`;
  const PY_ESCAPE = `os.${"system"}`;
  const py = (line) =>
    `python3 - <<'PY'\nadded = r${three}\n  ${line}\n  assert.match(ran(\`cd sub && git ${verb}\`), /reverts/u);\n${three}\nopen("t.test.mjs", "a").write(added)\nPY`;
  const js = (line) =>
    `node - <<'JS'\nconst added = "  cd sub && git ${verb}";\n${line}\nappendFileSync("t.md", added);\nJS`;
  assert.ok(decide(py(`${NODE_ESCAPE}("git", ["init", "-q", clean]);`)).allowed, "the one call this was found by");
  assert.equal(decide(py(`${PY_ESCAPE}(cmd)`)).allowed, false, "while python's own escape still hands its literals over");
  assert.ok(decide(js(`const note = "${SPAWNING}";`)).allowed, "and the same the other way round");
  assert.equal(decide(js(`const cp = require("child_process");`)).allowed, false, "node's own still counting");
  assert.ok(decide(`python3 -c 'open("t","a").write("&& git ${verb}"); note = "${NODE_ESCAPE}"'`).allowed,
    "the -c route splits the same way, the runner being named there too");
  assert.equal(decide(`python3 -c 'import os; ${PY_ESCAPE}("git ${verb}")'`).allowed, false);
  assert.ok(decide(`node -e 'appendFileSync("t", "&& git ${verb}"); const note = "${SPAWNING}";'`).allowed);
  assert.equal(decide(`node -e '${NODE_ESCAPE}("git ${verb}")'`).allowed, false);
  assert.equal(
    decide(`perl - <<'PL'\nmy $x = "&& git ${verb}"; my $n = "${SPAWNING}"; print "$x$n";\nPL`).allowed,
    false,
    "a runner whose escapes nobody enumerated keeps every name: one refusal on doubt",
  );
});

/* The same names read a shell's body, where they belong to no language it speaks: one line saying
   `execSync` swapped the body for its literals and bought the verb under it a pass (ISS-239). */
test("a body a shell runs is commands, whatever names it happens to carry", () => {
  const verb = "stash";
  const NODE_ESCAPE = `exec${"Sync"}`;
  const body = (line) => `bash <<'SH'\n${line}git ${verb}\nSH`;
  assert.equal(decide(body("")).allowed, false, "the plain body");
  assert.equal(decide(body(`note=${NODE_ESCAPE}\n`)).allowed, false, "and one token more, which hands node nothing");
  assert.equal(decide(`sh <<'SH'\ngrep -rn ${SPAWNING} .\ngit checkout -- a.txt\nSH`).allowed, false);
  assert.equal(decide(`zsh <<'SH'\necho ${NODE_ESCAPE}\n${STAGE_ALL}\nSH`).allowed, false);
  assert.ok(decide(`bash <<'SH'\necho "git ${verb}"\nSH`).allowed, "while a literal there is still an argument");
});

/* The three shapes counted in the transcripts, and the two routes the refusal has to offer instead:
   1,691 poll-shaped calls on one project in three days, 46 of them lost to the shell tool's cap. */
test("a wait that polls is refused, and a pause on its own is not", () => {
  const nap = `sl${"eep"}`;
  const first = decide(`until curl -sf localhost:3000; do ${nap} 5; done`);
  assert.equal(first.allowed, false);
  assert.match(first.reason, /foreground with the tool's own timeout/u, "the first route");
  assert.match(first.reason, /background and let the harness's completion notice/u, "the second");
  assert.match(first.reason, /ten-minute cap/u, "and what the foreground one is bounded by");
  assert.match(first.reason, /forge hooks --how polling/u, "the argument has its own page");
  assert.equal(decide(`while ! grep -q ready /tmp/log; do ${nap} 10; done`).allowed, false);
  assert.equal(decide(`while true; do date; ${nap} 30; done`).allowed, false);
  assert.equal(decide(`until nc -z localhost 5432\ndo\n  ${nap} 5\ndone`).allowed, false, "`do` on its own line");
  assert.equal(decide(`npm test | while read -r l; do ${nap} 1; done`).allowed, false, "past a pipeline");
  assert.equal(decide(`until a; do until b; do ${nap} 1; done; done`).allowed, false, "and nested");
  assert.equal(decide(`! while true; do ${nap} 1; done`).allowed, false, "past a prefix that inverts");
  assert.equal(decide(`time until a; do ${nap} 1; done`).allowed, false, "and past one that measures");
  assert.equal(decide(`while true; do for x in a; do :; done; ${nap} 1; done`).allowed, false, "past a for whose done is not the wait's");
  assert.equal(decide(`until a; do select x in a; do :; done; ${nap} 1; done`).allowed, false, "and past a select's");
  assert.equal(decide(`while true; do for ((i=0; i<3; i++)); do :; done; ${nap} 1; done`).allowed, false, "and past an arithmetic head, whose own `;` the span reader cuts");
  assert.equal(decide(`while true; do for ((i=0; i<3; i++)) { :; }; ${nap} 1; done`).allowed, false, "and past the brace body an arithmetic for may take instead, which no done closes");
  assert.equal(decide(`while true; for ((i=0; i<3; i++)) { :; }; do ${nap} 1; done`).allowed, false, "and where that brace body is in the wait's condition, so the do is still the wait's");
  assert.equal(decide(`while true; for x in a; do :; done; do ${nap} 1; done`).allowed, false, "and where the loop in the condition takes a do of its own, which is not the wait's");
  assert.equal(decide(`while true; for ((i=0; for < 3; i++)) { :; }; do ${nap} 1; done`).allowed, false, "and where an arithmetic head names a variable spelled like a loop, which opens none");
  assert.equal(decide(`while true; do ${nap} 1; for ((i=0; i<1; i++)) { :; while false; do :; done; }; done`).allowed, false, "and where a wait is written inside that brace body, whose do is its own");
  assert.equal(decide(`while true; do for x in "a { b"; do :; done; ${nap} 1; done`).allowed, false, "and where the brace is a character of a quoted word, which opens no body");
  assert.equal(decide(`while true; do for f in "a\\" { b"; do :; done; ${nap} 1; done`).allowed, false, "and where an escape inside that word carries the quote it would otherwise have closed");
  assert.equal(decide(`for x in a; do(:); done; while true; do ${nap} 1; done`).allowed, false, "and where a do opens on a subshell, so the loop before the wait takes its own");
  assert.equal(decide(`while true; do for x in { a; do :; done; ${nap} 1; done`).allowed, false, "and where a bare brace is ordinary data in a word list, no body a plain for could take");
  assert.equal(decide(`until a\ndo\n  for x in a\n  do\n    :\n  done\n  ${nap} 5\ndone`).allowed, false, "the same nesting spelled over lines");
  assert.ok(decide(`${nap} 2`).allowed, "a pause on its own waits once and asks nothing");
  assert.ok(decide(`${nap} 2 && npm test`).allowed, "one before the work is still one pause");
  assert.ok(decide(`${nap} 2 && until a; do echo x; done`).allowed, "and one before a wait is outside it");
  assert.ok(decide(`until a; do echo x; done && ${nap} 3`).allowed, "and one after a wait is outside it");
  assert.ok(decide(`while read -r l; do echo "$l"; done < /tmp/f`).allowed, "a wait with no pause polls nothing");
  assert.ok(decide(`for x in a b; do ${nap} 1; done`).allowed, "a for bounded by a count is no wait, so the pause in it stands");
  assert.ok(decide(`echo "until x; do ${nap} 1; done"`).allowed, "and the shape inside an argument is prose");
});

/* The reading the rule above spends, on its own, because the guard's verdict cannot say which frame
   a `done` closed: a `for` is pushed so that its own `done` pops it, and only a wait comes back as a
   range (ISS-306). */
test("a done closes the loop it belongs to, and only a wait is a range", () => {
  const nap = `sl${"eep"}`;
  const nested = `while true; do for x in a; do :; done; ${nap} 1; done`;
  const [[from, to], ...rest] = waitsIn(nested);
  assert.deepEqual([from, to, rest], [0, nested.length, []], "one range, the wait's own, running to its own done");
  const at = nested.indexOf(nap);
  assert.ok(at >= from && at < to, `the pause at ${at} is inside it, and not past the inner done at ${nested.indexOf("done")}`);
  assert.deepEqual(waitsIn(`for x in a b; do ${nap} 1; done`), [], "a for's body is a frame too, and is no wait");
  const braced = `while true; do for ((i=0;i<3;i++)) { :; }; while :; do ${nap} 1; done; done`;
  assert.equal(waitsIn(braced).length, 2, "a brace body opens no frame, so it takes no done and leaves both waits their own");
  assert.deepEqual(waitsIn("until a; do until b; do :; done; done"), [[8, 31], [0, 37]], "nested waits still answer innermost first");
});

/* The stash stack is the repository's, not the worktree's: a push in one tree is what a pop in
   another takes. So the tree about to receive somebody else's work is clean by definition, which is
   the one state `needsDirtyTree` stands the rule down in. */
const sharedStack = () => {
  const room = tempRoom("shared-stack-");
  const git = (at, ...args) =>
    spawnSync("git", ["-C", at, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", room], { encoding: "utf8" });
  writeFileSync(join(room, "tracked.txt"), "committed\n");
  git(room, "add", "tracked.txt");
  git(room, "commit", "-qm", "base");
  const second = join(tempRoom("shared-stack-out-"), "wt");
  const added = git(room, "worktree", "add", "-q", "-b", "second", second);
  assert.equal(added.status, 0, added.stderr);
  return { room, second };
};

test("a stash that moves a shared stack is refused in a clean worktree too", () => {
  const verb = "stash";
  const { room, second } = sharedStack();
  const refused = from(second, `git ${verb} pop`);
  assert.match(refused, /stack belongs to the repository/u, "the reason a clean tree is refused at all");
  assert.match(refused, /git worktree/u, "the first route out");
  assert.match(refused, /aside/u, "and the second");
  assert.equal(from(cleanRepo(), `git ${verb} pop`).trim(), "", "one worktree keeps today's reading");
  assert.equal(from(second, `git ${verb} list`).trim(), "", "reading the stack still moves nothing");
  assert.equal(from(second, `git ${verb} show -p`).trim(), "", "nor does showing one");
  assert.match(from(cleanRepo(), `git -C ${room} ${verb} pop`), /stack belongs to the repository/u, "counted in the tree named");
  assert.match(from(DIRTY, `git ${verb}`), /silently reverts/u, "and a dirty single worktree reads as it did");
});

/* The wait taken out of the loop and one read typed per turn, which the rule above cannot see: over
   24h, 11 runs of 60 spent 228 turns reading their own gate or ship log while it ran. */
test("the same read of a log typed again is refused, and another question of it is not", () => {
  const session = randomUUID();
  const read = "tail -50 /tmp/ship.log";
  assert.ok(decideIn(session, read).allowed, "the first read asks something nobody knows yet");
  const again = decideIn(session, read);
  assert.equal(again.allowed, false);
  assert.match(again.reason, /\/tmp\/ship\.log/u, "the refusal names the log it is about");
  assert.match(again.reason, /still running/u, "what to do while the work writing it runs");
  assert.match(again.reason, /already\s+ended/u, "and what to do once that work has ended");
  assert.match(again.reason, /came too early/u, "which is what the read before it was, since this gate cannot see the notice");
  assert.match(again.reason, /is a different question/u, "so the way through is named rather than left to be found");
  assert.match(again.reason, /says a thing once/u, "and the refusal that cannot see the log finish leaves a way past itself");
  assert.ok(decideIn(session, read).allowed, "which is the read after the refusal, since the refusal cleared what it was made from");
  assert.equal(decideIn(session, read).allowed, false, "and the one after that is a repeat again");
  assert.match(again.reason, /forge hooks --how polling/u, "the argument has its own page");
  assert.ok(decideIn(session, "grep -n error /tmp/ship.log").allowed, "another question is not the same ask");
  assert.ok(decideIn(session, "tail -20 /tmp/ship.log").allowed, "nor is another depth of the same one");
});

test("what stands between two identical reads is what decides the second", () => {
  const session = randomUUID();
  const read = "tail -20 /tmp/gate.log";
  assert.ok(decideIn(session, read).allowed);
  assert.ok(decideIn(session, "echo checking").allowed, "a label is not work");
  assert.equal(decideIn(session, read).allowed, false, "so the read past it is still the read before it");
  assert.ok(decideIn(session, "npm test").allowed, "and this is");
  assert.ok(decideIn(session, read).allowed, "so the read past that one asks something new");
  assert.ok(decideIn(session, "x", "Edit").allowed, "a call this gate judges nothing of is still a call");
  assert.ok(decideIn(session, read).allowed, "and it clears the memory too");
});

/* `.err` is named in no pattern of this gate: it answers for one because the class has one home. */
test("a repeat nobody was waiting on passes: another file, another session, a verb that wrote", () => {
  const session = randomUUID();
  const notALog = "cat /tmp/notes.txt";
  assert.ok(decideIn(session, notALog).allowed);
  assert.ok(decideIn(session, notALog).allowed, "a file being worked on is not one being waited for");
  const read = "tail -5 /tmp/build.err";
  assert.ok(decideIn(session, read).allowed);
  assert.ok(decideIn(randomUUID(), read).allowed, "another session has asked this of nothing");
  assert.equal(decideIn(session, read).allowed, false, "while this one has");
  assert.ok(decideIn(session, "echo done > /tmp/flag.log").allowed, "a redirect writes, whatever the verb");
  assert.ok(decideIn(session, read).allowed, "so the read past it is new again");
});


/* Keyed on the command as the transcript records it, so the gate and `forge stats runs` cannot refuse
   and count different things. Everything the two would read apart is outside the rule instead. */
test("a shape the profiler could not key the same way is outside this rule, not read a second way", () => {
  const session = randomUUID();
  const wrapped = "bash -c 'tail -5 /tmp/ship.log'";
  assert.ok(decideIn(session, wrapped).allowed);
  assert.ok(decideIn(session, wrapped).allowed, "a body this rule does not open is no read of a log");
  const asked = "grep 'error  code' /tmp/ship.log";
  assert.ok(decideIn(session, asked).allowed);
  assert.ok(decideIn(session, "grep 'error code' /tmp/ship.log").allowed, "quoted spacing is the question");
  assert.equal(decideIn(session, "grep 'error code' /tmp/ship.log").allowed, false, "and asking it twice is not");
});
