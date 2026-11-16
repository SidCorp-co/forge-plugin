/* The two shapes of a poll bash-guard teaches: a wait that sleeps, and one read of a log typed again
   with nothing done between. Each is let through and taught; how/polling.md is the argument. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { waitsIn } from "../../../src/hooks/shell-spans.mjs";
import { WAIT_COMMAND } from "../../../src/hooks/wait-idiom.mjs";
import { callHook, dirtyRepo, homeEnv } from "../../fixtures.mjs";

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "hooks");
const HOOK = join(HOOKS, "entries", "bash-guard.mjs");
const HOME = homeEnv("bash-guard-polling");
const DIRTY = dirtyRepo();

/* The session travels in the event and the environment both: the stamps key on the one, the shown ledger on the other. */
const decideIn = (session, command, tool = "Bash") => {
  const run = callHook(HOOK, { session_id: session, tool_name: tool, tool_input: { command }, cwd: DIRTY }, { ...HOME, FORGE_SESSION_ID: session });
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true, taught: "" };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason, taught: answer.additionalContext ?? "" };
};

const taughtBy = (command, session = randomUUID()) => {
  const run = decideIn(session, command);
  assert.equal(run.allowed, true, `${command} was refused, and it is taught: ${run.reason}`);
  return run.taught;
};

test("a polling teaching names its span, its topic page and the rule, and is said once a session", () => {
  const session = randomUUID();
  const wait = "until grep -q done log.txt; do sleep 5; done";
  const first = taughtBy(wait, session);
  assert.match(first, /A sleep inside a wait polls/u);
  assert.ok(first.includes("`sleep 5`"), first);
  assert.ok(first.includes("`forge hooks --how polling` (cause: bash-guard/sleep-in-wait)"), first);
  assert.equal(taughtBy(wait, session), "", "the second wait in the session runs in silence");
});


/* The three shapes counted in the transcripts, and the routes the refusal has to offer instead:
   1,691 poll-shaped calls on one project in three days, 46 of them lost to the shell tool's cap.
   Every route named is one whose own call comes back to the caller, because five runs on ISS-943
   took the one that does not and never saw their answer. */
test("a wait that polls is taught, and a pause on its own is not", () => {
  const nap = `sl${"eep"}`;
  const first = { reason: taughtBy(`until curl -sf localhost:3000; do ${nap} 5; done`) };
  assert.match(first.reason, /comes back to you/u, "the line every route it offers is picked by");
  assert.match(first.reason, /foreground under the tool's own timeout/u, "the route for work this call starts");
  assert.ok(first.reason.includes(WAIT_COMMAND), "the one for work already running, which a run cannot go back and relaunch");
  assert.match(first.reason, /Monitor/u, "and the one for a wait past the cap");
  assert.match(first.reason, /ten-minute cap/u, "and what the foreground one is bounded by");
  assert.doesNotMatch(first.reason, /completion notice/u, "while the route that comes back to nobody is offered as none of them");
  assert.match(first.reason, /Backgrounding this same loop is no way out/u, "and the second attempt this refusal used to invite is answered inside the first");
  assert.match(first.reason, /forge hooks --how polling/u, "the argument has its own page");
  assert.match(taughtBy(`while ! grep -q ready /tmp/log; do ${nap} 10; done`), /A sleep inside a wait polls/u);
  assert.match(taughtBy(`while true; do date; ${nap} 30; done`), /A sleep inside a wait polls/u);
  assert.match(taughtBy(`until nc -z localhost 5432\ndo\n  ${nap} 5\ndone`), /A sleep inside a wait polls/u, "`do` on its own line");
  assert.match(taughtBy(`npm test | while read -r l; do ${nap} 1; done`), /A sleep inside a wait polls/u, "past a pipeline");
  assert.match(taughtBy(`until a; do until b; do ${nap} 1; done; done`), /A sleep inside a wait polls/u, "and nested");
  assert.match(taughtBy(`! while true; do ${nap} 1; done`), /A sleep inside a wait polls/u, "past a prefix that inverts");
  assert.match(taughtBy(`time until a; do ${nap} 1; done`), /A sleep inside a wait polls/u, "and past one that measures");
  assert.match(taughtBy(`while true; do for x in a; do :; done; ${nap} 1; done`), /A sleep inside a wait polls/u, "past a for whose done is not the wait's");
  assert.match(taughtBy(`until a; do select x in a; do :; done; ${nap} 1; done`), /A sleep inside a wait polls/u, "and past a select's");
  assert.match(taughtBy(`while true; do for ((i=0; i<3; i++)); do :; done; ${nap} 1; done`), /A sleep inside a wait polls/u, "and past an arithmetic head, whose own `;` the span reader cuts");
  assert.match(taughtBy(`while true; do for ((i=0; i<3; i++)) { :; }; ${nap} 1; done`), /A sleep inside a wait polls/u, "and past the brace body an arithmetic for may take instead, which no done closes");
  assert.match(taughtBy(`while true; for ((i=0; i<3; i++)) { :; }; do ${nap} 1; done`), /A sleep inside a wait polls/u, "and where that brace body is in the wait's condition, so the do is still the wait's");
  assert.match(taughtBy(`while true; for x in a; do :; done; do ${nap} 1; done`), /A sleep inside a wait polls/u, "and where the loop in the condition takes a do of its own, which is not the wait's");
  assert.match(taughtBy(`while true; for ((i=0; for < 3; i++)) { :; }; do ${nap} 1; done`), /A sleep inside a wait polls/u, "and where an arithmetic head names a variable spelled like a loop, which opens none");
  assert.match(taughtBy(`while true; do ${nap} 1; for ((i=0; i<1; i++)) { :; while false; do :; done; }; done`), /A sleep inside a wait polls/u, "and where a wait is written inside that brace body, whose do is its own");
  assert.match(taughtBy(`while true; do for x in "a { b"; do :; done; ${nap} 1; done`), /A sleep inside a wait polls/u, "and where the brace is a character of a quoted word, which opens no body");
  assert.match(taughtBy(`while true; do for f in "a\\" { b"; do :; done; ${nap} 1; done`), /A sleep inside a wait polls/u, "and where an escape inside that word carries the quote it would otherwise have closed");
  assert.match(taughtBy(`for x in a; do(:); done; while true; do ${nap} 1; done`), /A sleep inside a wait polls/u, "and where a do opens on a subshell, so the loop before the wait takes its own");
  assert.match(taughtBy(`while true; do for x in { a; do :; done; ${nap} 1; done`), /A sleep inside a wait polls/u, "and where a bare brace is ordinary data in a word list, no body a plain for could take");
  assert.match(taughtBy(`until a\ndo\n  for x in a\n  do\n    :\n  done\n  ${nap} 5\ndone`), /A sleep inside a wait polls/u, "the same nesting spelled over lines");
  assert.equal(taughtBy(`${nap} 2`), "", "a pause on its own waits once and asks nothing");
  assert.equal(taughtBy(`${nap} 2 && npm test`), "", "one before the work is still one pause");
  assert.equal(taughtBy(`${nap} 2 && until a; do echo x; done`), "", "and one before a wait is outside it");
  assert.equal(taughtBy(`until a; do echo x; done && ${nap} 3`), "", "and one after a wait is outside it");
  assert.equal(taughtBy(`while read -r l; do echo "$l"; done < /tmp/f`), "", "a wait with no pause polls nothing");
  assert.equal(taughtBy(`for x in a b; do ${nap} 1; done`), "", "a for bounded by a count is no wait, so the pause in it stands");
  assert.equal(taughtBy(`echo "until x; do ${nap} 1; done"`), "", "and the shape inside an argument is prose");
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

/* The wait taken out of the loop and one read typed per turn, which the rule above cannot see: over
   24h, 11 runs of 60 spent 228 turns reading their own gate or ship log while it ran. */
test("the same read of a log typed again is taught, and another question of it is not", () => {
  const session = randomUUID();
  const read = "tail -50 /tmp/ship.log";
  assert.equal(taughtBy(read, session), "", "the first read asks something nobody knows yet");
  const again = { reason: taughtBy(read, session) };
  assert.match(again.reason, /\/tmp\/ship\.log/u, "the refusal names the log it is about");
  assert.match(again.reason, /still running/u, "what to do while the work writing it runs");
  assert.match(again.reason, /comes back to you/u, "which is a call that returns, and not a notice that reaches a run only while it is still going");
  assert.doesNotMatch(again.reason, /completion notice/u, "so this refusal sends nobody where the one above does not");
  assert.match(again.reason, /already\s+ended/u, "and what to do once that work has ended");
  assert.match(again.reason, /came too early/u, "which is what the read before it was, since this gate cannot see the notice");
  assert.match(again.reason, /is a different question/u, "so the way through is named rather than left to be found");
  assert.match(again.reason, /says a thing once/u, "and the teaching that cannot see the log finish says when it is quiet");
  assert.equal(taughtBy(read, session), "", "which is the read after the teaching, since the teaching cleared what it was made from");
  assert.notEqual(taughtBy(read, session), "", "and the one after that is a repeat again");
  assert.match(again.reason, /forge hooks --how polling/u, "the argument has its own page");
  assert.equal(taughtBy("grep -n error /tmp/ship.log", session), "", "another question is not the same ask");
  assert.equal(taughtBy("tail -20 /tmp/ship.log", session), "", "nor is another depth of the same one");
});

test("what stands between two identical reads is what decides the second", () => {
  const session = randomUUID();
  const read = "tail -20 /tmp/gate.log";
  assert.equal(taughtBy(read, session), "");
  assert.equal(taughtBy("echo checking", session), "", "a label is not work");
  assert.notEqual(taughtBy(read, session), "", "so the read past it is still the read before it");
  assert.equal(taughtBy("npm test", session), "", "and this is");
  assert.equal(taughtBy(read, session), "", "so the read past that one asks something new");
  assert.ok(decideIn(session, "x", "Edit").allowed, "a call this gate judges nothing of is still a call");
  assert.equal(taughtBy(read, session), "", "and it clears the memory too");
});

/* `.err` is named in no pattern of this gate: it answers for one because the class has one home. */
test("a repeat nobody was waiting on passes: another file, another session, a verb that wrote", () => {
  const session = randomUUID();
  const notALog = "cat /tmp/notes.txt";
  assert.equal(taughtBy(notALog, session), "");
  assert.equal(taughtBy(notALog, session), "", "a file being worked on is not one being waited for");
  const read = "tail -5 /tmp/build.err";
  assert.equal(taughtBy(read, session), "");
  assert.equal(taughtBy(read), "", "another session has asked this of nothing");
  assert.notEqual(taughtBy(read, session), "", "while this one has");
  assert.equal(taughtBy("echo done > /tmp/flag.log", session), "", "a redirect writes, whatever the verb");
  assert.equal(taughtBy(read, session), "", "so the read past it is new again");
});


/* Keyed on the command as the transcript records it, so the gate and `forge stats runs` cannot refuse
   and count different things. Everything the two would read apart is outside the rule instead. */
test("a shape the profiler could not key the same way is outside this rule, not read a second way", () => {
  const session = randomUUID();
  const wrapped = "bash -c 'tail -5 /tmp/ship.log'";
  assert.equal(taughtBy(wrapped, session), "");
  assert.equal(taughtBy(wrapped, session), "", "a body this rule does not open is no read of a log");
  const asked = "grep 'error  code' /tmp/ship.log";
  assert.equal(taughtBy(asked, session), "");
  assert.equal(taughtBy("grep 'error code' /tmp/ship.log", session), "", "quoted spacing is the question");
  assert.notEqual(taughtBy("grep 'error code' /tmp/ship.log", session), "", "and asking it twice is not");
});

/* One command, three readers: this refusal, the page it points at, and the corpus reading that
   counts what a run typed. The page imports nothing, being markdown, so the case is what holds it to
   the spelling the other two share (ISS-2086). */
test("the wait this gate prescribes is the one the page it points at prescribes", () => {
  const nap = `sl${"eep"}`;
  const taught = taughtBy(`until curl -sf localhost:3000; do ${nap} 5; done`);
  assert.ok(taught.includes(WAIT_COMMAND), "the teaching prints the command whole");
  const page = readFileSync(join(HOOKS, "how", "polling.md"), "utf8");
  assert.ok(page.includes(WAIT_COMMAND),
    `\`forge hooks --how polling\` prescribes the same command, character for character:\n${page}`);
});
