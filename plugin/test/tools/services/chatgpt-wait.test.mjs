/* The deadline one call runs under, which is now the caller's to set: `--wait` against values the
   clock reads, values it does not, and one past what a timer here can hold. Split off rather than
   added beside the turn's own cases, which are already at the file's limit (ISS-1270).

   Every case that means to block stays under ten minutes, past which the turn is handed to a process
   whose request would land in the next case's count; the two clamped ones cannot, so they stand last. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../..", import.meta.url).pathname;
const KEY = "sm_stub_key_never_a_real_credential";
const PNG = Buffer.from("89504e470d0a1a0a", "hex");
const REFUSED_FILE = "the-backend-says-no.png";

const state = { stalls: false, calls: [], uploads: 0, origin: "http://127.0.0.1" };

const REPLY = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  result: { content: [{ type: "text", text: JSON.stringify({ answers: "the stub answered" }) }] },
});

/* Headers flushed and the body never sent, as the suite beside this one does: a deadline that only
   covered the headers would pass a case where nothing arrives at all. */
const stalled = (response) => {
  response.writeHead(200, { "content-type": "application/json" });
  return response.flushHeaders();
};

/* The multipart body is kept so an upload can be refused by the name the caller gave it: a case
   needing a refusal and one needing an answer are then two files rather than two modes. */
const served = (request, response) => {
  const url = new URL(request.url, state.origin);
  let sent = "";
  const answer = () => {
    if (url.pathname === "/api/upload") {
      state.uploads += 1;
      if (state.stalls) return stalled(response);
      if (sent.includes(REFUSED_FILE)) return response.writeHead(400).end(`${REFUSED_FILE} is not a file this takes`);
      return response.writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ url: `${state.origin}/held/one.png` }));
    }
    state.calls.push(url.pathname);
    if (state.stalls) return stalled(response);
    return response.writeHead(200, { "content-type": "application/json" }).end(REPLY);
  };
  request.on("data", (chunk) => {
    sent += chunk.toString("latin1");
  });
  request.on("end", answer);
};

const stub = createServer(served);
await new Promise((listening) => stub.listen(0, "127.0.0.1", listening));
state.origin = `http://127.0.0.1:${stub.address().port}`;
test.after(() => stub.close());

const home = tempHome("chatgpt-wait");
test.after(() => home.remove());

const configFile = () => join(home.path, "forge", "config.json");

const seeded = (waits) => {
  mkdirSync(join(home.path, "forge"), { recursive: true });
  writeFileSync(configFile(), JSON.stringify({
    url: `${state.origin}/mcp`,
    token: "not-a-real-tracker-token",
    waitSeconds: waits,
    chatgpt: { url: `${state.origin}/mcp`, key: KEY },
  }));
  return { ...process.env, XDG_CONFIG_HOME: home.path, FORGE_SESSION_ID: "chatgpt-wait-suite" };
};

const ran = (env, ...argv) => {
  state.calls = [];
  state.uploads = 0;
  return ranAsync(FORGE, ["chatgpt", "ask", ...argv], env, ROOT, null);
};

/* The whole of the issue in one case: the file says one minute, the call says two seconds, and two
   seconds is what it gets — so the number a turn that draws a picture wants is no longer the number
   a tracker call inherits (ISS-1270). */
test("the wait is the call's own, and the file's sixty seconds is not what it runs under", async () => {
  state.stalls = true;
  const began = Date.now();
  const run = await ran(seeded(60), "wait for me", "--wait", "2");
  const spent = Date.now() - began;
  assert.equal(run.status, 1);
  assert.match(run.stderr, /ran out after 2s \(the caller's own deadline\)/u);
  assert.ok(spent < 30_000, `it ran for ${spent}ms, which is the file's wait rather than the call's`);
  assert.equal(state.calls.length, 1, "a deadline is not a reason to send a second turn");
});

test("a wait far past anything the file names is taken, and the line before the wait names it", async () => {
  state.stalls = false;
  const run = await ran(seeded(60), "a long one", "--wait", "599");
  assert.equal(run.status, 0);
  assert.match(run.stderr, /one turn, waiting up to 599s\./u);
  assert.equal(state.calls.length, 1);
});

/* Nothing sent covers the uploads too: the deadline is built before the attachments go up, so a
   value the clock cannot read must not cost a turn or a file. */
test("a wait the clock cannot read is refused before anything is sent, naming what was typed", async () => {
  state.stalls = false;
  const path = join(home.path, "refused.png");
  writeFileSync(path, PNG);
  for (const bad of ["0", "-1", "abc", "Infinity", "0.0006"]) {
    const run = await ran(seeded(60), "never sent", "--file", path, "--wait", bad);
    assert.equal(run.status, 1, `\`${bad}\` was taken as a wait`);
    assert.ok(run.stderr.includes(`--wait takes a number of seconds, 0.001 at the least, and \`${bad}\` is not one`),
      `the refusal for \`${bad}\` did not name it: ${run.stderr}`);
    assert.equal(state.calls.length, 0, `\`${bad}\` sent a turn`);
    assert.equal(state.uploads, 0, `\`${bad}\` uploaded a file`);
  }
});

/* Nearest and not floor or ceiling, which 0.0014 and 0.0016 tell apart and 0.001 alone does not. */
test("an accepted wait reaches the clock at the nearest whole millisecond", async () => {
  state.stalls = true;
  for (const [asked, got] of [["0.001", "0.001"], ["0.0014", "0.001"], ["0.0016", "0.002"]]) {
    const run = await ran(seeded(60), "too short to answer", "--wait", asked);
    assert.equal(run.status, 1);
    assert.ok(run.stderr.includes(`ran out after ${got}s (the caller's own deadline)`),
      `--wait ${asked} did not reach the clock as ${got}s: ${run.stderr}`);
  }
});

test("--wait writes nothing, so the file every tracker call reads is byte for byte what it was", async () => {
  state.stalls = false;
  const env = seeded(60);
  const before = readFileSync(configFile());
  await ran(env, "a call with its own wait", "--wait", "599");
  assert.deepEqual(readFileSync(configFile()), before);
});

test("the uploads of a call run under that call's own wait rather than the file's", async () => {
  state.stalls = true;
  const path = join(home.path, "one.png");
  writeFileSync(path, PNG);
  const run = await ran(seeded(60), "one that stalls", "--file", path, "--wait", "0.1");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /did not finish — ran out after 0\.1s \(the caller's own deadline\)/u);
  assert.equal(state.calls.length, 0, "and no turn was sent");
});

/* A platform limit met by being told what you got: `AbortSignal.timeout` validates against the
   unsigned range while the timer under it fires at 1ms past the signed one, so a longer ask cannot
   be honoured — and refusing it would be a judgement about which asks this verb serves. A wait that
   long is also one nobody holds, so these two are the file's only detaching cases and stand last. */
test("a wait past the longest a timer here holds is clamped to it, and the call names both numbers", async () => {
  state.stalls = false;
  const run = await ran(seeded(60), "past the timer", "--wait", "1e9");
  assert.equal(run.status, 0);
  assert.match(run.stderr, /1000000000s is past the longest a timer here holds, so this turn waits 2147483\.647s\./u);
  assert.match(run.stdout, /^turn {6}[0-9a-f]{8}$/mu, "and the turn it clamped is one this call handed on");
});

/* Told any later, the caller has already spent that wait once without knowing which number it was. */
test("a clamped wait is named by the call that asked for it, beside the id that turn was given", async () => {
  state.stalls = false;
  const path = join(home.path, REFUSED_FILE);
  writeFileSync(path, PNG);
  const run = await ran(seeded(60), "past the timer, with a file", "--file", path, "--wait", "1e9");
  assert.equal(run.status, 0);
  assert.match(run.stderr, /is past the longest a timer here holds/u);
  assert.match(run.stdout, /^collect {3}forge chatgpt collect [0-9a-f]{8}$/mu);
});
