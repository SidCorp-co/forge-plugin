/* What the fixtures here leave running once their runner is gone: four `tracker-process.mjs` were
   found serving at 2h24m long after the gate that started them wrote its verdict (ISS-1619), an
   `exit` hook reaping the clean exit alone. The child watches the spawner instead, and without that
   tie each case below leaves the very process the issue found. A leak is found here on the process
   table under the runner that started it and never by a file the leaker wrote, which would have to be
   reclaimed by whoever found it — the race this repository already refuses for gate counting. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { tiedSpawn } from "./run-fixtures.mjs";

const PROC = "/proc";
const HAS_PROC = existsSync(join(PROC, "self", "stat"));
const TRACKER = "tracker-process.mjs";
const FIXTURES = join(import.meta.dirname, "run-fixtures.mjs");
const SPAWNER = join(import.meta.dirname, "ends-with-spawner.mjs");
const GONE = 10_000;

const read = (at) => {
  try {
    return readFileSync(at, "utf8");
  } catch {
    return null;
  }
};

const cmdlineOf = (pid) => (read(join(PROC, String(pid), "cmdline")) ?? "").split("\0").join(" ");

// Field 4 of the status line, counted from after its last `)`, the command name holding both spaces and parentheses.
const ppidOf = (pid) => {
  const stat = read(join(PROC, String(pid), "stat"));
  return stat === null ? null : Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
};

/** Still a running process: a zombie and a pid that is gone both read as no command at all. */
const running = (pid) => cmdlineOf(pid) !== "";

const startedBy = (word, parent) => readdirSync(PROC)
  .filter((one) => /^\d+$/u.test(one))
  .map(Number)
  .filter((pid) => cmdlineOf(pid).includes(word) && ppidOf(pid) === parent);

const waited = async (until) => {
  const stop = Date.now() + GONE;
  while (!until() && Date.now() < stop) {
    await new Promise((wake) => setTimeout(wake, 50));
  }
  return until();
};

// Tied to this test process for the reason the fixture's own children are: a case killed before it reaches its own kill leaves nothing behind either.
const runner = (body) => tiedSpawn(["--input-type=module", "-e",
  `await import(${JSON.stringify(SPAWNER)});\n${body}`]);

const spoke = (child) => new Promise((done) => {
  let said = "";
  child.stdout.on("data", (chunk) => {
    said += chunk;
    if (said.includes("\n")) done(said.trim());
  });
});

const LOADS = `await import(${JSON.stringify(FIXTURES)});\nprocess.stdout.write("loaded\\n");`;

const trackerOf = (child) => {
  const served = startedBy(TRACKER, child.pid);
  assert.equal(served.length, 1, `the fixtures started ${served.length} trackers under this runner, not one`);
  return served[0];
};

/* By pid, and only the pids this case's own runner started: a failing case is the run that leaks, and
   an orphan holding the suite's stderr keeps the gate itself from exiting rather than only a case. */
const reaped = async (pids) => {
  await waited(() => pids.every((pid) => !running(pid)));
  const left = pids.filter(running);
  for (const pid of left) process.kill(pid, "SIGKILL");
  return left;
};

// The clean exit is judged beside the three signals rather than trusted: it is the one ending the hook this replaces did cover, so a tie that broke it would trade one leak for another.
const ENDINGS = [
  ["killed with SIGKILL", (one) => one.kill("SIGKILL")],
  ["killed with SIGTERM", (one) => one.kill("SIGTERM")],
  ["interrupted", (one) => one.kill("SIGINT")],
  ["exited normally", (one) => one.stdin.end()],
];

for (const [ending, end] of ENDINGS) {
  test(`a runner ${ending} while the run fixtures are loaded leaves no tracker serving`,
    { skip: !HAS_PROC }, async () => {
      const child = runner(LOADS);
      await spoke(child);
      const served = trackerOf(child);

      end(child);
      const left = await reaped([served]);
      assert.deepEqual(left, [], `tracker ${left.join(" ")} outlived a runner ${ending}`);
    });

  test(`a runner ${ending} takes the process a case points a lock at with it`,
    { skip: !HAS_PROC }, async () => {
      const child = runner(`const { alive } = await import(${JSON.stringify(FIXTURES)});\n`
        + `process.stdout.write(alive().pid + "\\n");`);
      const held = Number(await spoke(child));
      const served = trackerOf(child);
      assert.ok(running(held), `the fixtures started no process to point a lock at: ${held}`);

      end(child);
      const left = await reaped([held, served]);
      assert.deepEqual(left, [], `${left.join(" ")} outlived a runner ${ending}`);
    });
}
