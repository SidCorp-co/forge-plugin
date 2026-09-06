/* Three outcomes and not two: paths-or-nothing cannot say "inert", and a gate reading it that way
   forgets the log across a typed label — `tail x.log`, `echo checking`, `tail x.log` walked through. */
import assert from "node:assert/strict";
import test from "node:test";

import { LOG_NAME, NOTHING, logRead, logsIn } from "../src/hooks/log-reads.mjs";

test("a call that did nothing but read a log answers a key, and one that asks again shares it", () => {
  assert.equal(logRead("tail -50 /tmp/ship.log"), "tail -50 /tmp/ship.log");
  assert.equal(logRead("tail  -50   /tmp/ship.log"), logRead("tail -50 /tmp/ship.log"), "spacing settled");
  assert.notEqual(logRead("grep err /tmp/ship.log"), logRead("tail -50 /tmp/ship.log"), "another question");
  assert.notEqual(logRead("tail -20 /tmp/ship.log"), logRead("tail -50 /tmp/ship.log"), "and another depth");
  assert.deepEqual(logsIn("tail /tmp/a.log; tail /tmp/b.log"), ["/tmp/a.log", "/tmp/b.log"]);
});

test("a call that did something answers nothing at all, so the memory of the last read is dropped", () => {
  for (const one of [
    "npm test",
    "tail -5 /tmp/x.log && npm test",
    "npm run check > /tmp/x.log 2>&1",
    "tail -5 /tmp/x.log > /tmp/y.txt",
    "cat plugin/src/cli.mjs",
    "grep -rn poll plugin/",
    "sed -n '1,50p' /tmp/x.log",
  ]) assert.equal(logRead(one), null, one);
});

test("an inert call is neither, and a redirect takes the inertness away", () => {
  assert.equal(logRead("echo checking"), NOTHING);
  assert.equal(logRead("cd /w"), NOTHING);
  assert.equal(logRead("echo === ; tail -5 /tmp/x.log"), "echo === ; tail -5 /tmp/x.log", "beside a read");
  assert.equal(logRead("echo fixed > source.js"), null, "which writes, whatever the verb");
});

/* The one home this pattern has: `bash-guard.mjs` and `transcripts.mjs` both answer for an extension
   neither of them names, which is the only way they can be reading it from here. */
test("a log is named by its extension, and the harness's own capture is one", () => {
  for (const one of ["/tmp/a.log", "/w/b.out", "/t/c.output", "/t/d.err"]) assert.match(one, LOG_NAME);
  for (const one of ["/tmp/a.txt", "/w/b.md", "/w/notes.logs"]) assert.doesNotMatch(one, LOG_NAME);
  assert.equal(logRead("cat /tmp/claude-1000/p/s/tasks/abc.output"), "cat /tmp/claude-1000/p/s/tasks/abc.output");
  assert.equal(logRead("cat notes.txt"), null, "a file that is not a log was being worked on, not waited for");
});

/* Three shapes the first draft read wrong, each letting one call stand in for another. The text
   arrives unexpanded, as the transcript records it: how/polling.md carries why. */
test("a key is the question, so quoting, a substitution and a wrapper are all read as they are typed", () => {
  assert.notEqual(
    logRead("grep 'error  code' /tmp/ship.log"),
    logRead("grep 'error code' /tmp/ship.log"),
    "settling the spacing inside a quoted argument would make two questions one",
  );
  assert.equal(logRead('echo "$(touch source.js)"'), null, "a substitution runs, whatever holds it");
  assert.equal(logRead("tail $(ls -t /tmp/*.log | head -1)"), null, "and one naming the log is no different");
  assert.equal(logRead("bash -c 'tail /tmp/ship.log'"), null, "a body this reading does not open is not a read it can see");
});
