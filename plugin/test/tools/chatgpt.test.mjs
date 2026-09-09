/* The verb against a stub wearing the backend's shapes, spawned as the real CLI so the config, the
   parser and the printer are all the ones a user gets. What the stub is for: the upstream's browser
   pool was empty for every turn of the 2026-09-08 probe, so a gate needing it is a gate that goes
   red for the weather (ISS-791).

   The claim under most of these is that one invocation is one turn. A retry against a metered
   upstream can spend a second one, so `calls` is asserted on the failure paths and not only the
   good one. */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import test from "node:test";

import { ranAsync, tempHome } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;
const KEY = "sm_stub_key_never_a_real_credential";
const PNG = Buffer.from("89504e470d0a1a0a", "hex");

const state = { mode: "json", calls: [], uploads: 0, sent: [] };

const answered = (out, meta = {}) => ({
  jsonrpc: "2.0",
  id: 1,
  result: { content: [{ type: "text", text: JSON.stringify(out) }], _meta: meta },
});

const BODIES = {
  /* A notification carries no id, and the impostor carries this request's id with a method beside
     it — which is what the transport's own server-to-client requests look like. */
  json: () => JSON.stringify(answered({ answers: "the stub answered" }, { account: "acct-7" })),
  sse: () => [
    `data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/progress", params: {} })}\n\n`,
    `data: ${JSON.stringify(answered({ answers: "past the notification" }, { account: "acct-7" }))}\n\n`,
  ].join(""),
  impostor: () => [
    `data: ${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sampling/createMessage", params: {} })}\n\n`,
    `data: ${JSON.stringify(answered({ answers: "past the impostor" }))}\n\n`,
  ].join(""),
  strangerId: () => JSON.stringify({ jsonrpc: "2.0", id: 99, result: { content: [] } }),
  torn: () => '{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"tex',
  /* The upstream really does sometimes answer an object rather than a string, which the backend's
     own comment says it coerces only for its length column — so the verb must not coerce it. */
  parsed: () => JSON.stringify(answered({ answers: { rows: [1, 2], note: "already an object" } })),
  noText: () => JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [], _meta: { conversationId: "conv-5" } } }),
  refused: () => JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: {
      content: [{ type: "text", text: "No browser available right now. Please try again later." }],
      isError: true,
      _meta: { conversationId: "conv-9" },
    },
  }),
  image: () => JSON.stringify(answered({ answers: "drawn", imageUrl: `${state.origin}/image.png` })),
  /* A signed URL is routinely longer than any cap worth putting on a quoted error body, so a
     redactor that also truncates breaks a link it had no key to strike (consult ea77c3, F1). */
  longUrl: () => JSON.stringify(answered({
    answers: "drawn",
    imageUrl: `${state.origin}/image.png?signature=${"s".repeat(500)}`,
  })),
  /* The key arriving back through a field the verb interpolates rather than through the message it
     already struck: a redaction that stops at the sentence prints it on the next line. */
  keyInMeta: () => JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: {
      content: [{ type: "text", text: "the tool would not run" }],
      isError: true,
      _meta: { conversationId: `conv-${KEY}` },
    },
  }),
  /* The gateway that puts the request's own Authorization back in its error body, which is the one
     way the configured key reaches a terminal (consult 4f91a2, F2). */
  echoes: () => `502 from the gateway, upstream said: authorization: Bearer ${KEY}`,
};

const served = (request, response) => {
  const url = new URL(request.url, state.origin);
  state.authorization = request.headers.authorization ?? null;
  state.verb = request.method;
  /* Its own switch rather than a mode: the reply has to name an image for the download to be
     attempted at all, so serving the image and refusing it are two axes and not one. */
  if (url.pathname === "/image.png") {
    if (state.imageGone) return response.writeHead(403).end("<html>expired signature</html>");
    return response.writeHead(200, { "content-type": "image/png" }).end(PNG);
  }
  if (url.pathname === "/api/upload") {
    state.uploads += 1;
    if (state.mode === "unsupported") {
      return response.writeHead(415, { "content-type": "text/plain" })
        .end(`.xyz is not one of: png, jpg, pdf — and your key was Bearer ${KEY}`);
    }
    return response.writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ id: "up-1", url: `${state.origin}/held/one.png`, name: "one.png", mime: "image/png", size: 8 }));
  }
  /* Answered before the body is read, as a real redirector does, and pointing at a path that counts
     its own arrivals: `fetch` follows a 307 with the POST intact, so a verb that allows one sends a
     second tools/call and the count is what shows it. */
  if (state.mode === "moved" && url.pathname === "/mcp") {
    state.calls.push(url.pathname);
    return response.writeHead(307, { location: `${state.origin}/mcp-moved` }).end();
  }
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    state.calls.push(url.pathname);
    state.sent.push(JSON.parse(body));
    /* Flushed, or the headers never leave and the case proves only that a stalled connection times
       out — which a headers-only deadline would pass too (consult f30c11, F1). */
    if (state.mode === "stalls") {
      response.writeHead(200, { "content-type": "application/json" });
      return response.flushHeaders();
    }
    if (state.mode === "echoes") return response.writeHead(502, { "content-type": "text/plain" }).end(BODIES.echoes());
    const said = (BODIES[state.mode] ?? BODIES.json)();
    const type = state.mode === "sse" || state.mode === "impostor" ? "text/event-stream" : "application/json";
    return response.writeHead(200, { "content-type": type }).end(said);
  });
};

const stub = createServer(served);
await new Promise((listening) => stub.listen(0, "127.0.0.1", listening));
state.origin = `http://127.0.0.1:${stub.address().port}`;
test.after(() => stub.close());

/* A second origin nothing is meant to reach: the crossed-upload case fails loudly here rather than
   quietly posting one caller's file to the other's host. */
const other = createServer((request, response) => {
  state.calls.push(`OTHER ${request.url}`);
  response.writeHead(500).end("nothing should reach this origin");
});
await new Promise((listening) => other.listen(0, "127.0.0.1", listening));
test.after(() => other.close());

const home = tempHome("chatgpt");
test.after(() => home.remove());

const seeded = (chatgpt, extra = {}) => {
  mkdirSync(join(home.path, "forge"), { recursive: true });
  writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({
    url: `${other.address ? `http://127.0.0.1:${other.address().port}` : ""}/mcp`,
    token: "not-a-real-tracker-token",
    waitSeconds: 2,
    ...extra,
    ...(chatgpt ? { chatgpt } : {}),
  }));
  return { ...process.env, XDG_CONFIG_HOME: home.path, FORGE_SESSION_ID: "chatgpt-suite" };
};

const configured = () => seeded({ url: `${state.origin}/mcp`, key: KEY });

const ran = (env, ...argv) => {
  state.calls = [];
  state.sent = [];
  state.uploads = 0;
  return ranAsync(FORGE, ["chatgpt", ...argv], env, ROOT, null);
};

const asked = (mode, ...argv) => {
  state.mode = mode;
  return ran(configured(), ...argv);
};

/* Through the CLI rather than the exported text: without `answersHelp` the dispatcher answers `-h`
   off the verb table before the verb sees it, and every line below is silently missing. */
test("-h is answered by the verb, and states the one attempt, the cap and the deadline in force", async () => {
  state.mode = "json";
  const run = await ran(seeded({ url: `${state.origin}/mcp`, key: KEY }), "-h");
  assert.equal(run.status, 0);
  assert.match(run.stdout, /sent once and never again/u);
  assert.match(run.stdout, /up to 10/u);
  assert.match(run.stdout, /no default is sent/u);
  assert.match(run.stdout, /The wait is \d+s, from waitSeconds in config\.json\./u);
  assert.equal(state.calls.length, 0);
});

/* A flag where the prompt belongs is two mistakes, and the stranger is the one worth naming: a
   refusal that only said the prompt was missing left a typo of a real flag unnamed. */
test("a stranger flag standing in the prompt's place is named, and a real one still misses the prompt", async () => {
  state.mode = "json";
  const env = seeded({ url: `${state.origin}/mcp`, key: KEY });
  const stranger = await ran(env, "--zzz", "x");
  assert.equal(stranger.status, 1);
  assert.match(stranger.stderr, /No chatgpt flag named --zzz\. The set is/u);
  const missing = await ran(env, "--model", "gpt-5.6");
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /the prompt comes first/u);
  assert.equal(state.calls.length, 0);
});

test("no endpoint or key: the refusal names the doctor flag for each, and sends nothing", async () => {
  state.mode = "json";
  const run = await ran(seeded(null), "a prompt it never gets to send");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--chatgpt-url <endpoint>/u);
  assert.match(run.stderr, /--chatgpt-key <key>/u);
  assert.equal(state.calls.length, 0, "nothing is sent before the credential is there");
});

test("a JSON reply prints the answer, the account and the resume line", async () => {
  const run = await asked("json", "what do you say");
  assert.equal(run.status, 0);
  assert.match(run.stdout, /the stub answered/u);
  assert.match(run.stdout, /account   acct-7/u);
  assert.equal(state.calls.length, 1, "one turn per invocation");
  assert.equal(state.sent[0].params.arguments.prompt, "what do you say");
});

test("an answer that is already an object prints as JSON rather than being coerced to a string", async () => {
  const run = await asked("parsed", "answer me in JSON");
  assert.equal(run.status, 0);
  assert.match(run.stdout, /"already an object"/u);
  assert.match(run.stdout, /"rows": \[/u, "printed as JSON, not as [object Object]");
});

test("keepContext is never sent false by this verb, which would disable an image turn upstream", async () => {
  await asked("json", "draw me a thing");
  assert.notEqual(state.sent[0].params.arguments.keepContext, false);
});

/* The shape on the wire, which every other case here takes for granted: nothing else asserts the
   method, the tool's name or the credential, so all three could move unnoticed. */
test("one turn is a tools/call of chatgpt at the configured endpoint, under the configured key", async () => {
  const run = await asked("json", "what shape is this");
  assert.equal(run.status, 0);
  assert.deepEqual(state.calls, ["/mcp"], "one request, at the endpoint that was configured");
  /* The HTTP verb, which the JSON-RPC method is not: a turn sent as PUT would satisfy every other
     line here (consult 6b02a4, F1). */
  assert.equal(state.verb, "POST");
  assert.equal(state.sent[0].jsonrpc, "2.0");
  assert.equal(state.sent[0].method, "tools/call");
  assert.equal(state.sent[0].params.name, "chatgpt");
  assert.equal(state.authorization, `Bearer ${KEY}`);
});

test("an event stream is read past a progress notification, which carries no id", async () => {
  const run = await asked("sse", "over the stream");
  assert.equal(run.status, 0);
  assert.match(run.stdout, /past the notification/u);
});

/* F1: the id alone is satisfiable by a message that is not an answer. */
test("a same-id message carrying a method is not read as the answer", async () => {
  const run = await asked("impostor", "past the impostor please");
  assert.equal(run.status, 0);
  assert.match(run.stdout, /past the impostor/u);
});

test("a reply under another id is refused rather than read, and is not sent again", async () => {
  const run = await asked("strangerId", "whose answer is this");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /could not be read as this request's answer/u);
  assert.equal(state.calls.length, 1);
});

test("a result with no text part is refused as a spent turn, not printed as an empty answer", async () => {
  const run = await asked("noText", "say nothing at all");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /carried no answer to read/u);
  assert.match(run.stderr, /--resume conv-5/u, "the id that came back is the way on");
  assert.equal(state.calls.length, 1);
});

test("isError says the turn may have been spent, names the conversation it salvaged, and stops", async () => {
  const run = await asked("refused", "draw me something");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No browser available right now/u);
  assert.match(run.stderr, /may have been spent and is not sent again/u);
  assert.match(run.stderr, /--resume conv-9/u);
  assert.equal(state.calls.length, 1, "a failure is not a reason to send a second turn");
});

test("a body that never finishes runs out on the deadline, the headers having already arrived", async () => {
  const run = await asked("stalls", "wait for me");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /ran out after 2s/u);
  assert.equal(state.calls.length, 1);
});

/* One turn means one request on the wire, not one call to fetch. */
test("a 307 on the endpoint is refused rather than followed, so the turn reaches one address only", async () => {
  const run = await asked("moved", "do not send this twice");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /may have been spent and is not sent again/u);
  assert.deepEqual(state.calls, ["/mcp"], "the redirect target is never asked");
});

test("a key echoed back through the conversation id is struck out of the failure too", async () => {
  const run = await asked("keyInMeta", "the id carries it");
  assert.equal(run.status, 1);
  assert.ok(!run.stderr.includes(KEY), "a redaction that stops at the sentence is not a redaction");
  assert.match(run.stderr, /--resume conv-<the key>/u);
  assert.equal(state.calls.length, 1);
});

test("--resume sends the id as conversationId", async () => {
  const run = await asked("json", "and then", "--resume", "conv-42");
  assert.equal(run.status, 0);
  assert.equal(state.sent[0].params.arguments.conversationId, "conv-42");
});

test("--model is passed through, and is absent when it is not asked for", async () => {
  await asked("json", "with a model", "--model", "gpt-5.6");
  assert.equal(state.sent[0].params.arguments.model, "gpt-5.6");
  await asked("json", "with no model");
  assert.ok(!("model" in state.sent[0].params.arguments), "no default is sent from here");
});

test("a local --file is uploaded first and the turn carries the URL the upload answered", async () => {
  const path = join(home.path, "one.png");
  writeFileSync(path, PNG);
  const run = await asked("json", "describe this", "--file", path);
  assert.equal(run.status, 0);
  assert.equal(state.uploads, 1);
  assert.deepEqual(state.sent[0].params.arguments.files, [`${state.origin}/held/one.png`]);
});

test("a --file that is already a URL is sent untouched and uploads nothing", async () => {
  const run = await asked("json", "and this one", "--file", "https://example.com/held/two.png");
  assert.equal(run.status, 0);
  assert.equal(state.uploads, 0);
  assert.deepEqual(state.sent[0].params.arguments.files, ["https://example.com/held/two.png"]);
});

test("the upload goes to the origin beside the chatgpt endpoint, never the tracker's", async () => {
  const path = join(home.path, "three.png");
  writeFileSync(path, PNG);
  const run = await asked("json", "the crossed case", "--file", path);
  assert.equal(run.status, 0);
  assert.ok(!state.calls.some((one) => one.startsWith("OTHER")), "the tracker's origin is not this verb's");
});

/* A valid path first, so the refusal is proven to come before the turn rather than merely before
   the upload of the file it complained about. */
test("a missing second file is refused with no turn sent and the first file's upload unspent", async () => {
  const good = join(home.path, "one.png");
  writeFileSync(good, PNG);
  const run = await asked("json", "one of these is not here", "--file", good, "--file", join(home.path, "absent.png"));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /no file at/u);
  assert.equal(state.calls.length, 0, "no turn is sent when one of the attachments is missing");
});

test("more files than the tool takes is refused before the first upload", async () => {
  const path = join(home.path, "one.png");
  const many = Array.from({ length: 11 }, () => ["--file", path]).flat();
  const run = await asked("json", "eleven of them", ...many);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /11 files, and the tool takes 10/u);
  assert.equal(state.uploads, 0);
});

/* F2: the one way the configured key reaches a terminal is a far side that echoes it back. */
test("a refused upload prints the backend's own words with the key struck out", async () => {
  const path = join(home.path, "one.png");
  state.mode = "unsupported";
  const run = await ran(configured(), "the wrong type", "--file", path);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /is not one of: png, jpg, pdf/u, "the type list is the backend's, not a copy");
  assert.ok(!run.stderr.includes(KEY), "the key never reaches a terminal");
  assert.match(run.stderr, /<the key>/u);
  assert.equal(state.calls.length, 0, "a refused attachment spends no turn at all");
});

test("a backend error body that echoes the key has it struck out too, and is not sent again", async () => {
  const run = await asked("echoes", "the gateway is unwell");
  assert.equal(run.status, 1);
  assert.ok(!run.stderr.includes(KEY));
  assert.match(run.stderr, /answered 502/u);
  /* A 502 is the most tempting thing in the world to retry, and the stub would answer a second
     attempt identically — so the count is the only thing that catches it (consult f30c11, F2). */
  assert.equal(state.calls.length, 1);
});

test("a body that will not parse is refused, and no second turn is sent to get a better one", async () => {
  state.mode = "torn";
  const run = await ran(configured(), "half a document please");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /could not be read as this request's answer/u);
  assert.equal(state.calls.length, 1);
});

test("a --resume turn that fails is counted the same as a fresh one", async () => {
  const run = await asked("refused", "carry on", "--resume", "conv-3");
  assert.equal(run.status, 1);
  assert.equal(state.calls.length, 1);
  assert.equal(state.sent[0].params.arguments.conversationId, "conv-3");
});

test("a signed image URL past the diagnostic cap is printed whole, not truncated by the redactor", async () => {
  const run = await asked("longUrl", "draw me a long one");
  assert.equal(run.status, 0);
  const url = `${state.origin}/image.png?signature=${"s".repeat(500)}`;
  assert.ok(run.stdout.includes(url), "the link a caller has to open is printed entire");
});

test("--save writes the bytes the image URL served", async () => {
  const path = join(home.path, "drawn.png");
  const run = await asked("image", "draw something", "--save", path);
  assert.equal(run.status, 0);
  assert.match(run.stdout, /saved     /u);
  assert.deepEqual(readFileSync(path), PNG);
});

/* F3: an error document written over the destination, under a line saying it was saved. */
test("an image URL answering 403 leaves the destination untouched and says so", async () => {
  const path = join(home.path, "kept.png");
  writeFileSync(path, PNG);
  const before = readFileSync(path);
  state.imageGone = true;
  const run = await asked("image", "draw something", "--save", path);
  state.imageGone = false;
  assert.equal(run.status, 1);
  assert.match(run.stderr, /answered 403/u);
  assert.ok(!run.stdout.includes("saved"), "nothing is reported saved that was not");
  assert.deepEqual(readFileSync(path), before, "the bytes that were there are still there");
  assert.equal(state.calls.length, 1, "a failed download is no reason to ask for the picture again");
});

test("an endpoint with no /mcp is refused for the upload, naming what it could not read", async () => {
  const path = join(home.path, "one.png");
  state.mode = "json";
  const run = await ran(seeded({ url: `${state.origin}/somewhere-else`, key: KEY }), "no mcp here", "--file", path);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /no \/mcp at the end of/u);
  assert.equal(state.uploads, 0);
  assert.ok(existsSync(path), "the file it was asked about is not touched either");
});
