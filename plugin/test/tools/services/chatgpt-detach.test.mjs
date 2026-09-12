/* The half of this verb that nobody is waiting for: a turn handed to a detached copy of the CLI,
   the record it settles into under a temporary config directory, and the three actions that read it
   back. Every case here spawns the real CLI against a stub wearing the backend's shapes, so the
   store's home, the child's own argv and the printer are the ones a user gets.

   `hang` is what makes the running cases possible: the stub takes the request and never answers, so
   the child is genuinely holding a connection while `pending`, `collect` and `--drop` are exercised
   against it. */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../..", import.meta.url).pathname;
const KEY = "sm_stub_key_never_a_real_credential";
const PNG = Buffer.from("89504e470d0a1a0a", "hex");
const SPENT = "This turn may have been spent and is not sent again — the tool cannot say whether it ran.";

const state = { mode: "json", calls: 0, origin: null, hung: [], imageGone: false };

const answered = (out) => JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  result: { content: [{ type: "text", text: JSON.stringify(out) }], _meta: { conversationId: "conv-9" } },
});

const stub = createServer((request, response) => {
  if (new URL(request.url, state.origin).pathname === "/image.png") {
    if (state.imageGone) return response.writeHead(403).end("<html>expired signature</html>");
    return response.writeHead(200, { "content-type": "image/png" }).end(PNG);
  }
  request.on("data", () => undefined);
  request.on("end", () => {
    state.calls += 1;
    if (state.mode === "hang") return state.hung.push(response);
    if (state.mode === "broken") return response.writeHead(500).end("the gateway fell over");
    const out = state.mode === "image"
      ? { answers: "drawn", conversationId: "conv-9", imageUrl: `${state.origin}/image.png` }
      : { answers: "the stub answered", conversationId: "conv-9" };
    return response.writeHead(200, { "content-type": "application/json" }).end(answered(out));
  });
  return undefined;
});
await new Promise((listening) => stub.listen(0, "127.0.0.1", listening));
state.origin = `http://127.0.0.1:${stub.address().port}`;
test.after(() => {
  for (const held of state.hung) held.end();
  stub.close();
});

const home = tempHome("chatgpt-detach");
test.after(() => home.remove());

/* One temporary home for the whole file, named on every invocation: a case that let this fall back
   would run on the developer's own credential and write the store beside their live token. */
const turnsDir = () => join(home.path, "forge", "chatgpt-turns");

const env = () => {
  mkdirSync(join(home.path, "forge"), { recursive: true });
  writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({
    url: `${state.origin}/mcp`,
    token: "not-a-real-tracker-token",
    waitSeconds: 2,
    chatgpt: { url: `${state.origin}/mcp`, key: KEY },
  }));
  return { ...process.env, XDG_CONFIG_HOME: home.path, FORGE_SESSION_ID: "chatgpt-detach-suite" };
};

const ran = (...argv) => ranAsync(FORGE, ["chatgpt", ...argv], env(), ROOT, null);

const idIn = (stdout) => /^turn {6}(\S+)$/mu.exec(stdout)?.[1] ?? null;

const recordOf = (id) => JSON.parse(readFileSync(join(turnsDir(), `${id}.json`), "utf8"));

const slept = (ms) => new Promise((wake) => setTimeout(wake, ms));

const until = async (holds, within = 10_000) => {
  const stop = Date.now() + within;
  for (;;) {
    const held = holds();
    if (held) return held;
    if (Date.now() >= stop) return null;
    await slept(50);
  }
};

const settled = (id) => until(() => {
  try {
    const record = recordOf(id);
    return record.state === "running" ? null : record;
  } catch {
    return null;
  }
});

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/* The child alone, run where this suite can watch it: the record is written by hand so its deadline
   is seconds rather than the ten minutes a detaching parent would have to be given. */
const asChild = (id, deadlineIn, ...argv) => {
  mkdirSync(turnsDir(), { recursive: true });
  const now = Date.now();
  writeFileSync(join(turnsDir(), `${id}.json`), JSON.stringify({
    id, prompt: argv[0], submittedAt: now, waitSeconds: deadlineIn / 1000,
    deadlineAt: now + deadlineIn, pid: null, state: "running",
  }));
  return ranAsync(FORGE, ["chatgpt", "ask", ...argv, "--wait", "601"],
    { ...env(), FORGE_CHATGPT_TURN: id }, ROOT, null);
};

const detached = async (...argv) => {
  const run = await ran("ask", ...argv, "--wait", "601");
  assert.equal(run.status, 0, run.stderr);
  const id = idIn(run.stdout);
  assert.ok(id, `no id in: ${run.stdout}`);
  return { run, id };
};

test("a wait past the cap returns without the answer, names the turn and prints what collects it", async () => {
  state.mode = "hang";
  const { run, id } = await detached("what do you say");
  assert.match(run.stdout, /^collect {3}forge chatgpt collect [0-9a-f]{8}$/mu);
  assert.ok(run.stdout.includes(`collect ${id}`), "the command names the id that was handed back");
  assert.doesNotMatch(run.stdout, /the stub answered/u, "it returned before any answer existed");
  const record = await until(() => (existsSync(join(turnsDir(), `${id}.json`)) ? recordOf(id) : null));
  assert.equal(record.state, "running");
  assert.ok(record.deadlineAt > record.submittedAt, "the record carries the deadline its child is under");
});

test("a wait the caller could hold blocks and prints the answer, and no record is made for it", async () => {
  state.mode = "json";
  const before = readdirSync(turnsDir()).length;
  const run = await ran("ask", "at the cap", "--wait", "600");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /the stub answered/u);
  assert.equal(idIn(run.stdout), null, "nothing detached, so nothing was handed back to collect");
  assert.equal(readdirSync(turnsDir()).length, before, "a blocking turn writes no record");
});

test("the answer a detached turn came back with is collected, twice, and then is not pending", async () => {
  state.mode = "json";
  const { id } = await detached("what do you say");
  assert.ok(await settled(id), "the child settled its own record");
  const first = await ran("collect", id);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /the stub answered/u);
  assert.match(first.stdout, /^resume {4}forge chatgpt ask "<next>" --resume conv-9$/mu);
  const again = await ran("collect", id);
  assert.equal(again.status, 0);
  assert.match(again.stdout, /the stub answered/u, "a caller who lost the output has nowhere else to read it");
  const waiting = await ran("pending");
  assert.doesNotMatch(waiting.stdout, new RegExp(id, "u"), "a turn that has been read is not waiting");
});

test("pending lists a running turn with its age, and collect turns one away rather than printing nothing", async () => {
  state.mode = "hang";
  const { id } = await detached("held open");
  const waiting = await ran("pending");
  assert.equal(waiting.status, 0);
  assert.match(waiting.stdout, new RegExp(`^${id} {2}running +\\d+s {2}held open$`, "mu"));
  const early = await ran("collect", id);
  assert.equal(early.status, 1);
  assert.match(early.stderr, /is still running, \d+s in, and has nothing to read yet/u);
  assert.match(early.stderr, new RegExp(`forge chatgpt collect ${id} --wait <s>`, "u"));
});

test("a collect that waits returns when the turn settles, and one whose wait runs out leaves it collectable", async () => {
  state.mode = "hang";
  const { id } = await detached("held then released");
  const short = Date.now();
  const tooShort = await ran("collect", id, "--wait", "2");
  assert.equal(tooShort.status, 1, "a wait that ran out says the turn is still running");
  assert.ok(Date.now() - short >= 2000, "it waited the seconds it was given");
  const waiting = ran("collect", id, "--wait", "30");
  const from = Date.now();
  await slept(500);
  state.mode = "json";
  for (const held of state.hung.splice(0)) held.writeHead(200, { "content-type": "application/json" })
    .end(answered({ answers: "released at last", conversationId: "conv-9" }));
  const done = await waiting;
  assert.equal(done.status, 0, done.stderr);
  assert.match(done.stdout, /released at last/u, "the turn that ran out a moment ago was still there to collect");
  assert.ok(Date.now() - from < 25_000, "it returned on the settlement rather than at the end of its wait");
});

test("a detached turn that failed is collected as one that may have been spent", async () => {
  state.mode = "broken";
  const { id } = await detached("it will not work");
  assert.ok(await settled(id), "a failure settles the record rather than leaving it running");
  const run = await ran("collect", id);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /the backend answered 500/u);
  assert.ok(run.stderr.includes(SPENT), "nobody watched this one fail, so the meter line is owed");
});

test("a turn whose process is gone without settling is collected as one that may have been spent", async () => {
  mkdirSync(turnsDir(), { recursive: true });
  const id = "deadbeef";
  const long = Date.now() - 600_000;
  writeFileSync(join(turnsDir(), `${id}.json`), JSON.stringify({
    id, prompt: "nobody finished this", submittedAt: long, deadlineAt: long + 1000, pid: null, state: "running",
  }));
  const run = await ran("collect", id);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /stopped without answering — its process is gone and its wait has passed/u);
  assert.ok(run.stderr.includes(SPENT));
});

test("giving a turn up stops its own process, says the same thing about the meter, and empties pending", async () => {
  state.mode = "hang";
  const { id } = await detached("this one is given up");
  const record = await until(() => {
    const held = recordOf(id);
    return held.pid ? held : null;
  });
  assert.ok(alive(record.pid), "the child is holding the connection when the drop is made");
  const run = await ran("pending", "--drop", id);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stdout.includes(SPENT), "the drop says what every other failure here says");
  assert.match(run.stdout, /is given up and its own process has stopped/u);
  assert.ok(await until(() => !alive(record.pid)), "the child stopped itself rather than being signalled");
  const waiting = await ran("pending");
  assert.doesNotMatch(waiting.stdout, new RegExp(id, "u"));
});

/* The proof that nothing is signalled by pid, which no reading of the drop's output can give: the
   record names this very suite's process, and a drop that signalled what it recorded would take the
   test runner with it. */
test("a drop signals no process, even the one its own record names", async () => {
  mkdirSync(turnsDir(), { recursive: true });
  const id = "cafe0001";
  const now = Date.now();
  writeFileSync(join(turnsDir(), `${id}.json`), JSON.stringify({
    id, prompt: "names a process it did not start", submittedAt: now, deadlineAt: now + 60_000,
    pid: process.pid, state: "running",
  }));
  const run = await ran("pending", "--drop", id);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /has not said so within the time this waits/u);
  assert.ok(alive(process.pid), "the process that record named is this suite, and it is still running");
});

test("a turn already settled is given up without waiting for a child that is not there", async () => {
  state.mode = "json";
  const { id } = await detached("settled before it was dropped");
  assert.ok(await settled(id), "it answered first");
  const from = Date.now();
  const run = await ran("pending", "--drop", id);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /no process was left to tell/u);
  assert.ok(Date.now() - from < 10_000, "it did not wait out an acknowledgement nobody could send");
});

/* A late write by a child that was already given up, which is exactly what the marker exists for. */
test("a turn that settles after it was dropped is still reported as given up", async () => {
  mkdirSync(turnsDir(), { recursive: true });
  const id = "cafe0002";
  const now = Date.now();
  writeFileSync(join(turnsDir(), `${id}.drop`), `${new Date().toISOString()}\n`);
  writeFileSync(join(turnsDir(), `${id}.json`), JSON.stringify({
    id, prompt: "answered too late", submittedAt: now, deadlineAt: now + 60_000, pid: null,
    state: "answered", report: "an answer nobody is listening for",
  }));
  const run = await ran("collect", id);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /was given up before it answered/u);
  assert.doesNotMatch(run.stderr, /nobody is listening for/u, "the marker outranks the record beside it");
  const waiting = await ran("pending");
  assert.doesNotMatch(waiting.stdout, new RegExp(id, "u"));
});

test("the sweep takes what was read long ago and leaves an answer nobody has read", async () => {
  mkdirSync(turnsDir(), { recursive: true });
  const old = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const write = (id, extra) => writeFileSync(join(turnsDir(), `${id}.json`), JSON.stringify({
    id, prompt: "long ago", submittedAt: old, deadlineAt: old + 1000, pid: null, state: "answered",
    report: "an answer", ...extra,
  }));
  write("cafe0003", { collectedAt: old });
  write("cafe0004", {});
  await ran("pending");
  assert.equal(existsSync(join(turnsDir(), "cafe0003.json")), false, "a record already read is what a sweep may take");
  assert.equal(existsSync(join(turnsDir(), "cafe0004.json")), true, "an uncollected answer is what detaching promised to keep");
});

test("a detached image turn saves the bytes, and the saved path is in what is collected", async () => {
  state.mode = "image";
  const out = join(home.path, "drawn.png");
  const { id } = await detached("draw me something", "--save", out);
  assert.ok(await settled(id), "the child settled");
  assert.deepEqual(readFileSync(out), PNG, "the child downloaded the image the reply named");
  const run = await ran("collect", id);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stdout.includes(`saved     ${out}`), run.stdout);
});

test("a file that is not there is refused before anything detaches", async () => {
  state.mode = "json";
  const before = readdirSync(turnsDir()).length;
  const run = await ran("ask", "attach nothing", "--file", join(home.path, "nowhere.png"), "--wait", "601");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /no file at .*nowhere\.png, so nothing was sent/u);
  assert.equal(readdirSync(turnsDir()).length, before, "no record was made, so no process was spawned");
});

test("every path this store reads and writes is under the temporary home, and none under the real one", async () => {
  const run = await ran("pending");
  assert.equal(run.status, 0);
  assert.ok(turnsDir().startsWith(home.path), `the store is at ${turnsDir()}`);
  assert.ok(readdirSync(turnsDir()).length > 0, "and it is where every case above wrote");
  assert.ok(env().XDG_CONFIG_HOME === home.path, "which is what every invocation here names");
});

/* F1: each request builds its own timer from the same seconds, so an upload, a turn and a download
   in a row outlive the deadline the record names — and a record read as abandoned while its child is
   still working makes the collect a second writer of it. */
test("the child stops at the deadline its record names, not at a fresh timer for each request", async () => {
  state.mode = "hang";
  const id = "cafe0005";
  const began = Date.now();
  const child = await asChild(id, 3000, "bounded by its own record");
  assert.equal(child.status, 0, child.stderr);
  const record = recordOf(id);
  assert.equal(record.state, "failed", "it settled itself rather than running on under its own --wait");
  assert.ok(Date.now() - began < 60_000, `it ran for ${Date.now() - began}ms against a deadline of 3000`);
  const run = await ran("collect", id);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /ran out after 3s, which is the wait this turn was submitted under/u);
  for (const held of state.hung.splice(0)) held.end();
});

/* F2: the child prepares inside the boundary where a refusal is thrown, or a file that went missing
   between the parent's look and the child's read exits it and leaves the record saying `running`. */
test("a child that cannot read an attachment settles as a failure rather than exiting on one", async () => {
  state.mode = "json";
  const id = "cafe0006";
  const child = await asChild(id, 60_000, "attach what is gone", "--file", join(home.path, "vanished.png"));
  assert.equal(child.status, 0, child.stderr);
  const record = recordOf(id);
  assert.equal(record.state, "failed");
  const run = await ran("collect", id);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /no file at .*vanished\.png, so nothing was sent/u);
});

/* F3: the turn is spent whether or not the picture downloads, and the recovery id is in the answer. */
test("a detached save that fails keeps the answer that turn already gave", async () => {
  state.mode = "image";
  state.imageGone = true;
  const out = join(home.path, "never-written.png");
  const { id } = await detached("draw me something that will not download", "--save", out);
  assert.ok(await settled(id), "the child settled");
  state.imageGone = false;
  assert.equal(existsSync(out), false, "nothing was written where the download failed");
  const run = await ran("collect", id);
  assert.equal(run.status, 1);
  assert.match(run.stdout, /^drawn$/mu, "the answer survived the download that did not");
  assert.match(run.stderr, /answered 403/u);
});

test("a detached save that cannot be written keeps the answer and the way on with it", async () => {
  state.mode = "image";
  const { id } = await detached("draw me something with nowhere to put it", "--save", home.path);
  assert.ok(await settled(id), "the child settled");
  const run = await ran("collect", id);
  assert.equal(run.status, 1);
  assert.match(run.stdout, /^drawn$/mu);
  assert.match(run.stdout, /^resume {4}forge chatgpt ask "<next>" --resume conv-9$/mu);
  assert.match(run.stderr, /the image named by this turn did not reach/u);
});
