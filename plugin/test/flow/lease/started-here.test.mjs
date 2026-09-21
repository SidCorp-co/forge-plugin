/* `startedHere` reads the turn's own record and not a directory: the case that matters is a wait
   typed with no `cd`, which keeps the session's working directory and so stands where every other
   run on that host stands. Every case spawns a real process, because a fake `/proc` would only
   prove this reads whatever it is handed (ISS-2051). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { startedHere } from "../../../src/flow/lease/holder.mjs";

/* The shape a harness gives a command it was handed: a shell whose own line carries the whole of
   it. Detached, so nothing here is a child this call would exclude as its own. */
const ran = (command) => {
  const child = spawn("/bin/sh", ["-c", command], { detached: true, stdio: "ignore" });
  child.unref();
  return child.pid;
};

const leaf = (argv) => {
  const child = spawn(argv[0], argv.slice(1), { detached: true, stdio: "ignore" });
  child.unref();
  return child.pid;
};

const gone = (...pids) => {
  for (const pid of pids) {
    /* Never 0 and never 1: `kill(0)` reaches this process's whole group, which is the runner and
       every case running beside this one, and a case that failed before it read a pid has a 0. */
    if (!(pid > 1)) continue;
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
};

/* Long enough that a spawn's own latency never straddles the boundary a case draws between two turns. */
const settled = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const held = (found, pid) => Boolean(found?.some((one) => one.pid === pid));

const waiting = () => `sleep 30 # started-here ${randomUUID()}`;

const standing = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const parentOf = (pid) =>
  Number(/^PPid:\s*(\d+)$/mu.exec(readFileSync(`/proc/${pid}/status`, "utf8"))?.[1]) || 0;

/* One call of a turn that began a moment ago and whose window is still open, which is every case
   below but the one about two turns. */
const turn = (said) => [{ said, from: Date.now() - 60_000, to: Date.now() + 60_000 }];

test("a process running a command this turn ran is found wherever it stands", async () => {
  const command = waiting();
  const pid = ran(command);
  try {
    await settled();
    const found = startedHere(turn(command));
    assert.ok(found, "the process table read");
    assert.ok(held(found, pid), `${pid} not among ${JSON.stringify(found)}`);
  } finally {
    gone(pid);
  }
});

/* The two-run case this rule exists for: two processes standing in the same directory under the
   same host, told apart by nothing but which turn's transcript names them. A reading that took
   ancestry, or the directory both stand in, would name both. */
test("a process another run started is not read as this turn's", async () => {
  const mine = waiting();
  const theirs = waiting();
  const ours = ran(mine);
  const others = ran(theirs);
  try {
    await settled();
    assert.ok(held(startedHere(turn(theirs)), others), "the other run's own command does not even reach its process");
    assert.ok(held(startedHere(turn(mine)), ours), "this turn's command does not reach its own process");
    assert.ok(!held(startedHere(turn(mine)), others), "another run's process was read as this turn's");
    assert.ok(!held(startedHere(turn(theirs)), ours), "this turn's process was read as another run's");
  } finally {
    gone(ours, others);
  }
});

/* Two runs of one project run the same commands, so the command alone cannot tell their processes
   apart; when each began can. The half that matters is the second assertion: the turn whose own
   process has already ended is not refused because its sibling's is still standing. */
test("the same command run by two turns is matched only by the call its own process began during", async () => {
  const command = waiting();
  const ours = ran(command);
  await settled(1000);
  const between = Date.now();
  await settled(1000);
  const theirs = ran(command);
  try {
    await settled();
    const earlier = [{ said: command, from: between - 60_000, to: between }];
    const later = [{ said: command, from: between, to: Date.now() + 60_000 }];
    assert.ok(held(startedHere(earlier), ours), "the earlier call does not reach the process it started");
    assert.ok(!held(startedHere(earlier), theirs), "a later run's identical command was read as the earlier call's");
    gone(ours);
    await settled();
    assert.deepEqual(startedHere(earlier), [],
      "a call whose own process has ended was still answered with its sibling's identical one");
    assert.ok(held(startedHere(later), theirs), "the later call does not reach the process it started");
  } finally {
    gone(ours, theirs);
  }
});

/* The shell that typed the wait exits and leaves the wait reparented, so the only line left is a
   part of the command rather than the whole of it. */
test("a wait a shell left behind is matched by the command that started it, and named by it", async () => {
  const watched = ran(waiting());
  const pid = leaf(["tail", `--pid=${watched}`, "-f", "/dev/null"]);
  try {
    await settled();
    const command = `timeout 1200 tail --pid=${watched} -f /dev/null; echo "ship process ended"`;
    const found = startedHere(turn(command));
    assert.ok(held(found, pid), "a leaf carrying part of the command was not matched");
    assert.equal(found.find((one) => one.pid === pid).command, command,
      "the row names the leaf's own fragment rather than the command the turn typed");
  } finally {
    gone(pid, watched);
  }
});

/* The same shape for real: the shell that typed the wait exits before the reading is taken, so the
   wait is reparented and nothing but its own words connects it to the turn. */
test("a wait a shell exited and left reparented is still matched by the command that put it there", async () => {
  const watched = ran(waiting());
  const said = resolve(tmpdir(), `started-here-${randomUUID()}`);
  const command = `nohup tail --pid=${watched} -f /dev/null > /dev/null 2>&1 & echo $! > ${said}`;
  const shell = ran(command);
  let pid = 0;
  try {
    await settled();
    assert.equal(standing(shell), false, "the shell that typed the wait is still standing, so nothing was reparented");
    pid = Number(readFileSync(said, "utf8").trim());
    assert.ok(pid > 1, `the shell wrote no pid to ${said}`);
    assert.notEqual(parentOf(pid), shell,
      "the wait still has the shell that typed it for a parent, so this case is not the one it claims to be");
    assert.ok(held(startedHere(turn(command)), pid), "a reparented wait was not matched by the command that started it");
  } finally {
    gone(pid, shell, watched);
    rmSync(said, { force: true });
  }
});

/* A command continued on the next line is one word list and not two — the backslash takes the
   newline with it — so a wait typed that way stands as the words its own line carries. */
test("a wait typed across a line continuation is still matched by the command that started it", async () => {
  const watched = ran(waiting());
  const pid = leaf(["tail", `--pid=${watched}`, "-f", "/dev/null"]);
  try {
    await settled();
    const command = `nohup tail --pid=${watched} \\\n  -f /dev/null > /dev/null 2>&1 &`;
    assert.ok(held(startedHere(turn(command)), pid),
      "a command continued on the next line was cut into words no shell would have made");
  } finally {
    gone(pid, watched);
  }
});

/* The other side of that: the turn's text carries another run's whole line, quoted as one argument
   of something that reads it rather than as the words a shell would have cut out and run. A
   containment over the flattened text cannot tell the two apart, and the words can (ISS-2062). */
test("a command line the turn only quoted as an argument does not make its process this turn's", async () => {
  const watched = ran(waiting());
  const pid = leaf(["tail", `--pid=${watched}`, "-f", "/dev/null"]);
  const line = `tail --pid=${watched} -f /dev/null`;
  try {
    await settled();
    assert.ok(held(startedHere(turn(`nohup ${line} > /dev/null 2>&1 &`)), pid),
      "the case proves nothing unless the words the turn typed as a command still reach the leaf");
    assert.ok(!held(startedHere(turn(`pgrep -f "${line}"`)), pid),
      "a line quoted as one argument of a reader was read as a process this turn started");
    assert.ok(!held(startedHere(turn(`echo "${line}" >> /dev/null`)), pid),
      "a line quoted into a note was read as a process this turn started");
    assert.ok(!held(startedHere(turn(`echo $'note\\' ${line} ' >> /dev/null`)), pid),
      "an apostrophe escaped inside an ANSI-C quote ended a word the shell keeps whole");
    assert.ok(!held(startedHere(turn(`echo "$(printf '%s' "note ${line} ")" >> /dev/null`)), pid),
      "a quote inside a substitution ended the argument the substitution stands in");
  } finally {
    gone(pid, watched);
  }
});

/* Both arms and not either. A word the turn joined across a continuation inside it is one word to
   the shell and two to the signature, so the words on their own would reach a process the signature
   never did. What matches is a subset of what the signature matched, which is what the criterion
   written as containment either way goes on reading. */
test("a process the signature does not reach is not reached by the words either", async () => {
  const watched = ran(waiting());
  const pid = leaf(["tail", `--pid=${watched}`, "-f", "/dev/null"]);
  try {
    await settled();
    const command = `nohup ta\\\nil --pid=${watched} -f /dev/null > /dev/null 2>&1 &`;
    assert.ok(!held(startedHere(turn(command)), pid),
      "a word joined across a continuation inside it reached a process the signature does not");
  } finally {
    gone(pid, watched);
  }
});

/* One path inside another is the collision a signature with no boundaries makes: run and
   run-other are two jobs, and a containment that ignores where a word ends reads them as one. */
test("a command whose path only begins another run's is not read as the same job", async () => {
  const mark = randomUUID();
  for (const tail of ["-other", ":other", ".other"]) {
    const mine = `sleep 30 # -f /tmp/started-here-${mark}`;
    const theirs = `${mine}${tail}`;
    const ours = ran(mine);
    const others = ran(theirs);
    try {
      await settled();
      assert.ok(held(startedHere(turn(mine)), ours), "the case proves nothing unless this turn's own is found");
      assert.ok(!held(startedHere(turn(mine)), others), `a path ending ${tail} was read as the one it begins with`);
      assert.ok(!held(startedHere(turn(theirs)), ours), `a path the one ending ${tail} begins with was read as it`);
    } finally {
      gone(ours, others);
    }
  }
});

/* The entry in the process table is stamped when the kernel makes it and not when something first
   asks for it, which is what lets a window close before the reading is taken. Nothing here touches
   /proc for this process until well after the window it was born in has shut. */
test("a process unobserved until long after its window closed is still placed inside it", async () => {
  const command = waiting();
  const opened = Date.now();
  const pid = ran(command);
  const closed = Date.now() + 1_000;
  try {
    await settled(4_000);
    assert.ok(held(startedHere([{ said: command, from: opened - 1_000, to: closed }]), pid),
      "a process first read three seconds past its window was placed at the moment it was read rather than born");
  } finally {
    gone(pid);
  }
});

test("a command too short to identify a process matches none", async () => {
  const command = waiting();
  const pid = ran(command);
  try {
    await settled();
    assert.ok(held(startedHere(turn(command)), pid), "the case proves nothing unless the long form matches");
    assert.deepEqual(startedHere(turn("sleep 30")), [],
      "a command short enough to be a word inside another run's is matched against the table anyway");
  } finally {
    gone(pid);
  }
});

test("this call's own chain is never read back as a process it started", () => {
  const found = startedHere(turn(process.argv.join(" ")));
  assert.ok(found === null || !found.some((one) => one.pid === process.pid),
    "the calling process was read as one this turn started");
});
