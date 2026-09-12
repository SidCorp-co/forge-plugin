/* The action that draws: what a caller is refused for not stating, what those statements make of the
   prompt on the wire, and the line that joins the next picture to this one. Every case runs the real
   CLI against a stub wearing the backend's shapes, because the composition and the refusals are both
   things a caller meets through argv. What no case here can settle — whether the model honours the
   shape it is told — is docs/cli/chatgpt-image.md's, proved by running it. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../..", import.meta.url).pathname;
const KEY = "sm_stub_key_never_a_real_credential";
const FRAMING = "Flat vector illustration, muted palette, no text anywhere.";
const PNG = Buffer.from("89504e470d0a1a0a", "hex");

const state = { sent: [], origin: null, mode: "image" };

const stub = createServer((request, response) => {
  if (new URL(request.url, state.origin).pathname === "/image.png") {
    return response.writeHead(200, { "content-type": "image/png" }).end(PNG);
  }
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    state.sent.push(JSON.parse(body));
    if (state.mode === "hang") return undefined;
    const out = { answers: "", conversationId: "conv-7", imageUrl: `${state.origin}/image.png` };
    return response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({
      jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: JSON.stringify(out) }] },
    }));
  });
  return undefined;
});
await new Promise((listening) => stub.listen(0, "127.0.0.1", listening));
state.origin = `http://127.0.0.1:${stub.address().port}`;
test.after(() => stub.close());

const home = tempHome("chatgpt-image");
test.after(() => home.remove());

/* The framing is a saved value, so each case says whether this machine has one: that is the whole
   difference between the two refusals below. */
const env = (prefix) => {
  mkdirSync(join(home.path, "forge"), { recursive: true });
  writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({
    url: `${state.origin}/mcp`,
    token: "not-a-real-tracker-token",
    waitSeconds: 5,
    chatgpt: { url: `${state.origin}/mcp`, key: KEY, ...(prefix ? { prefix } : {}) },
  }));
  return { ...process.env, XDG_CONFIG_HOME: home.path, FORGE_SESSION_ID: "chatgpt-image-suite" };
};

const ran = (prefix, ...argv) => {
  state.sent.length = 0;
  return ranAsync(FORGE, ["chatgpt", ...argv], env(prefix), ROOT, null);
};

const promptSent = () => state.sent[0].params.arguments.prompt;

test("the framing opens the prompt, the caller's words sit in the middle and the shape closes it, in one turn", async () => {
  const run = await ran(FRAMING, "image", "a fox asleep on a windowsill", "--ratio", "16:9");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.sent.length, 1, "one picture is one turn");
  const said = promptSent();
  assert.ok(said.startsWith(FRAMING), `the framing does not open the prompt: ${said}`);
  assert.match(said, /\n\na fox asleep on a windowsill\n\n/u, "the caller's words are their own paragraph");
  assert.match(said.split("\n").at(-1), /^Aspect ratio: 16:9\./u,
    "the shape is the last line and opens it, not a clause somewhere in the prose");
  assert.match(said, /exactly 16:9/u, "and it says exactly, or it is a preference");
});

test("a call that names no ratio is refused, and nothing is sent", async () => {
  const run = await ran(FRAMING, "image", "a fox asleep on a windowsill");
  assert.equal(run.status, 1);
  assert.equal(state.sent.length, 0, "a refusal spends no turn");
});

test("that refusal names the framing and the ratio both, and says which one is missing", async () => {
  const run = await ran(FRAMING, "image", "a fox asleep on a windowsill");
  assert.match(run.stderr, /states no ratio/u);
  assert.match(run.stderr, /^ {2}framing {3}saved/mu);
  assert.match(run.stderr, /^ {2}ratio {5}--ratio w:h/mu);
});

test("a call on a machine that saved no framing is refused, and nothing is sent", async () => {
  const run = await ran(null, "image", "a fox asleep on a windowsill", "--ratio", "16:9");
  assert.equal(run.status, 1);
  assert.equal(state.sent.length, 0, "a refusal spends no turn");
});

test("that refusal names the framing and the ratio both, and the flag that saves a framing", async () => {
  const run = await ran(null, "image", "a fox asleep on a windowsill", "--ratio", "16:9");
  assert.match(run.stderr, /states no framing/u);
  assert.match(run.stderr, /^ {2}framing {3}none saved — `forge doctor --chatgpt-prefix <framing>`/mu);
  assert.match(run.stderr, /^ {2}ratio {5}16:9, as this call asked/mu);
});

/* Named rather than read past: a ratio the parser cannot read is a shape the model would be told in
   words the caller did not mean, and the turn it would spend is the expensive half. */
test("a ratio that is not two whole numbers with a colon between them is refused, and nothing is sent", async () => {
  for (const given of ["16x9", "16:", "0:1", "sixteen by nine", "16:9:1"]) {
    const run = await ran(FRAMING, "image", "a fox", "--ratio", given);
    assert.equal(run.status, 1, `--ratio ${given} was not refused`);
    assert.match(run.stderr, /--ratio takes two whole numbers above nought/u);
    assert.equal(state.sent.length, 0, `--ratio ${given} spent a turn`);
  }
});

test("the reply's resume line carries the id, the image action and the ratio this call asked for", async () => {
  const run = await ran(FRAMING, "image", "a fox", "--ratio", "9:16");
  assert.match(run.stdout, /^resume {4}forge chatgpt image "<next>" --ratio 9:16 --resume conv-7$/mu);
});

/* The line is printed to be typed back, so it is typed back: a recovery line this verb's own parser
   turns away is the defect (review 829fc7, F1), and only running it can tell. */
test("the resume line this verb printed is a call this verb takes, and it continues the conversation", async () => {
  const first = await ran(FRAMING, "image", "a fox", "--ratio", "9:16");
  const line = first.stdout.split("\n").find((one) => one.startsWith("resume "));
  const argv = line.replace(/^resume\s+forge\s+/u, "").split(" ")
    .map((word) => (word === `"<next>"` ? "a badger" : word));
  state.sent.length = 0;
  const second = await ranAsync(FORGE, argv, env(FRAMING), ROOT, null);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(state.sent.length, 1);
  assert.equal(state.sent[0].params.arguments.conversationId, "conv-7",
    "the second picture joins the set the first drew");
  assert.match(promptSent(), /^Flat vector[\s\S]*\n\na badger\n\nAspect ratio: 9:16\./u);
});

test("image -h says in one clause why the prompt is written short, and runs to one screen", async () => {
  const run = await ran(FRAMING, "image", "-h");
  assert.equal(run.status, 0);
  assert.equal(state.sent.length, 0, "asking what to type sends no turn");
  assert.match(run.stdout, /Write the prompt short/u);
  assert.match(run.stdout, /elaborates a short\nprompt and transcribes a long one/u,
    "the reason is in the clause, or it is a rule with nothing behind it");
  assert.ok(run.stdout.split("\n").length <= 24,
    `image -h runs to ${run.stdout.split("\n").length} lines, which is past one screen`);
});

/* A file can hold blank text, and a caller who saved some framed nothing: the turn would be spent on
   a prompt opening with two newlines, and the report would say a framing was in force. */
test("a framing saved as blank text is no framing, and the picture is refused rather than drawn", async () => {
  const run = await ran("   \n  ", "image", "a fox", "--ratio", "16:9");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /states no framing/u);
  assert.equal(state.sent.length, 0, "a blank framing spent a turn");
});

/* The framing gates this action and nothing else: a machine that never saved one still asks
   questions, or a value the picture path needs has become a value every turn is refused for. */
test("a machine with no framing at all still sends a text turn", async () => {
  const run = await ran(null, "ask", "what do you say");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.sent.length, 1);
});

/* The flag that saves the framing is named in this text and is not a flag of this action: a caller
   typing it here would have it read as one and quietly ignored. */
test("the flag that saves the framing is named on this screen and refused as a flag of this action", async () => {
  const said = (await ran(FRAMING, "image", "-h")).stdout;
  assert.match(said, /forge doctor --chatgpt-prefix/u);
  const run = await ran(FRAMING, "image", "a fox", "--ratio", "1:1", "--chatgpt-prefix", "x");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No chatgpt image flag named --chatgpt-prefix/u);
  assert.equal(state.sent.length, 0);
});
