/* A consult read an open stdin to EOF and never returned: 17 and 13 minutes, killed by pid, the
   largest single round the eleventh dry run lost (ISS-65). The wait is for the first byte, and each
   rule here fails without it. */
import assert from "node:assert/strict";
import test from "node:test";
import { PassThrough } from "node:stream";
import { spawnSync } from "node:child_process";

import { homeEnv } from "../fixtures.mjs";
import { INTENT_MS, PAYLOAD_MS, stdinText } from "../../src/resolve/payload.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;

test("a pipe nobody writes to answers nothing, inside the deadline", async () => {
  const open = new PassThrough();
  const started = Date.now();
  assert.equal(await stdinText(open, 30), null, "null is `nothing fed it`, which is not an empty payload");
  assert.ok(Date.now() - started < 2_000, "and it does not wait on a producer that is not there");
});

test("a pipe with the intent on it is read whole, and its own EOF ends the read", async () => {
  const fed = new PassThrough();
  fed.write("the intent, ");
  setTimeout(() => fed.end("and its second half"), 5);
  assert.equal(await stdinText(fed, 50), "the intent, and its second half");
});

test("a terminal answers nothing without waiting at all, because it sends no EOF", async () => {
  const terminal = new PassThrough();
  terminal.isTTY = true;
  assert.equal(await stdinText(terminal, 5_000), null);
});

/* One byte then silence is the same unbounded wait, so what is bounded is the silence — and a
   payload cut in half is refused rather than returned. */
test("a producer that writes a byte and stalls is refused, never returned in half", async () => {
  const stalled = new PassThrough();
  stalled.write("half a plan");
  const held = process.exit;
  const stderr = console.error;
  const said = [];
  process.exit = () => {
    throw new Error("exited");
  };
  console.error = (line) => said.push(line);
  try {
    await assert.rejects(() => stdinText(stalled, 30), /exited/u);
    assert.match(said.join("\n"), /stdin went silent for 0\.03s after 11 byte\(s\)/u);
    assert.match(said.join("\n"), /read in half is worse than none/u);
  } finally {
    process.exit = held;
    console.error = stderr;
  }
});

test("a producer that keeps writing is not cut off by the deadline it keeps resetting", async () => {
  const slow = new PassThrough();
  const tick = (at) => setTimeout(() => {
    slow.write(`${at} `);
    if (at < 6) tick(at + 1);
    else slow.end("done");
  }, 10);
  tick(1);
  assert.equal(await stdinText(slow, 30), "1 2 3 4 5 6 done", "60ms of writing under a 30ms deadline");
});

/* A stream that fails after a chunk is not a short payload: the plan, the criteria and a comment
   would be written from whatever arrived. */
test("a read that fails part-way is refused, not returned truncated", async () => {
  const torn = new PassThrough();
  torn.write("half a plan");
  setTimeout(() => torn.destroy(new Error("the pipe broke")), 5);
  const held = process.exit;
  const stderr = console.error;
  const said = [];
  process.exit = () => {
    throw new Error("exited");
  };
  console.error = (line) => said.push(line);
  try {
    await assert.rejects(() => stdinText(torn, 50), /exited/u);
    assert.match(said.join("\n"), /stdin could not be read: the pipe broke/u);
    assert.match(said.join("\n"), /Nothing was used of what came before it/u);
  } finally {
    process.exit = held;
    console.error = stderr;
  }
});

test("a pipe that closes with nothing on it is a caller who meant to send something", async () => {
  const closed = new PassThrough();
  closed.end();
  assert.equal(await stdinText(closed, 50), "", "an empty string, which the `-` payload refuses by name");
});

/* The verb that reads a payload from `-` and the consult that reads an intent share the reader, so
   neither can wait forever while the other does not. On `feedback` and not `new`, whose priority rank
   is fetched off the tracker's declaration before the body is read: with a fresh config directory that
   spends the retries and refuses on the endpoint, so the case passed only where the developer's own
   credential answered (ISS-177). `feedback` reaches the reader before anything is resolved. */
test("a `-` payload on a silent pipe is refused with the deadline in the refusal", () => {
  const run = spawnSync(FORGE, ["feedback", "-", "--title", "never filed"], {
    encoding: "utf8",
    env: homeEnv("stdin-deadline"),
    input: "",
    timeout: 30_000,
  });
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /`-` read nothing from stdin/u);
  assert.doesNotMatch(run.stderr, /No Forge endpoint/u,
    "and it is the reader's refusal, not the one an unconfigured endpoint produces first");
  assert.ok(PAYLOAD_MS >= 5 * INTENT_MS, "a payload waits far longer than an intent, being the command itself");
});
