/* The half of this verb that sends nothing: what a caller reads before spending a turn, the action
   it is refused for not naming, and the refusal a flag in the prompt's place gets. Split off when the
   suite beside it passed max-lines. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../..", import.meta.url).pathname;

/* Counts and answers nothing: a dead port would prove no turn was sent by failing to connect. */
const calls = [];
const stub = createServer((request, response) => {
  calls.push(request.url);
  response.writeHead(500).end("{}");
});
await new Promise((listening) => stub.listen(0, "127.0.0.1", listening));
test.after(() => stub.close());

const home = tempHome("chatgpt-help");
test.after(() => home.remove());

const ran = (...argv) => {
  calls.length = 0;
  const origin = `http://127.0.0.1:${stub.address().port}`;
  mkdirSync(join(home.path, "forge"), { recursive: true });
  writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({
    url: `${origin}/mcp`,
    token: "not-a-real-tracker-token",
    waitSeconds: 2,
    chatgpt: { url: `${origin}/mcp`, key: "sm_stub_key_never_a_real_credential" },
  }));
  return ranAsync(FORGE, ["chatgpt", ...argv],
    { ...process.env, XDG_CONFIG_HOME: home.path, FORGE_SESSION_ID: "chatgpt-help-suite" }, ROOT, null);
};

/* Through the CLI: without `answersHelp` the dispatcher answers `-h` and every line below is lost. */
const helpText = async (...argv) => {
  const run = await ran(...argv, "-h");
  assert.equal(run.status, 0);
  assert.equal(calls.length, 0, "asking what to type sends no turn");
  return run.stdout;
};

const labels = (said) => said.split("\n")
  .filter((line) => /^ {2}\S/u.test(line) && !line.trim().startsWith("--"))
  .map((line) => line.trim().split(/ {2,}/u)[0]);

test("the verb's own -h is the list of actions and no flag of any of them", async () => {
  const said = await helpText();
  assert.deepEqual(labels(said), ["ask", "image", "collect", "pending"]);
  assert.equal(said.match(/--[a-z]+/gu), null, "a flag here is a second copy of some action's own help");
  assert.match(said, /forge chatgpt <action> -h/u, "and the row a caller reads next is named");
});

test("an action this verb does not have is refused with the nearest one it does, and sends nothing", async () => {
  const run = await ran("colect", "x");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No chatgpt action named colect\. Did you mean: collect\? The set is ask, image, collect, pending\./u);
  assert.equal(calls.length, 0);
});

/* The spelling this change retired. It is refused as an action rather than sent as a prompt, which is
   what makes the retirement a retirement and not a redirect. */
test("the bare prompt form is refused rather than sent", async () => {
  const run = await ran("what do you say");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No chatgpt action named what do you say/u);
  assert.equal(calls.length, 0);
});

test("ask -h states the one attempt, the cap, the deadline in force and where a longer wait goes", async () => {
  const said = await helpText("ask");
  assert.match(said, /One attempt per call and never a second/u);
  /* Never that it was spent: a timeout cannot say either way, and a line claiming the turn is gone
     would have a caller abandon work that may never have run. */
  assert.match(said, /may still have spent a metered turn/u);
  assert.doesNotMatch(said, /does not refund/u);
  assert.match(said, /up to 10/u);
  assert.match(said, /no default is sent/u);
  assert.match(said, /The wait is \d+s, from waitSeconds in config\.json; --wait sets this call's alone\./u,
    "the line naming where the wait comes from is the line that names the flag setting one call's");
  assert.match(said, /Past 600s the turn runs without you, and `forge chatgpt collect` reads it back\./u,
    "the number that decides is in the text, beside the command that reads the turn back");
});

/* Pinned by name, so dropping a row goes red here rather than passing as a shorter help text. The
   flag set is pinned beside them because a flag is the only handle this suite has on a use case
   arriving: a fifth turns this red, and whether it earns a row is judged then rather than never. */
test("ask -h carries one row per use case, and the flags that reach them are those five", async () => {
  const said = await helpText("ask");
  assert.deepEqual(labels(said), ["an answer", "a picture", "a follow-up"]);
  assert.deepEqual([...new Set(said.match(/--[a-z]+/gu))],
    ["--resume", "--model", "--file", "--save", "--wait"], "a flag added here owes the rows above another look");
});

test("the follow-up row carries the arithmetic and the picture row says what it is not", async () => {
  const said = await helpText("ask");
  const rowFor = (name) => said.split("\n").find((line) => line.trimStart().startsWith(`${name} `));
  assert.match(rowFor("a follow-up"), /one turn and not two/u);
  assert.match(rowFor("a picture"), /never a render of what you built/u);
});

/* A reader who meets the cost after the flags has already decided, and one who scrolls stops. */
test("the cost stands above the flag rows, and ask -h is one screen", async () => {
  const lines = (await helpText("ask")).split("\n");
  assert.ok(lines.length <= 24, `ask -h runs to ${lines.length} lines, which is past one screen`);
  const cost = lines.findIndex((line) => /One attempt per call/u.test(line));
  const flag = lines.findIndex((line) => line.startsWith("  --"));
  assert.ok(cost >= 0 && cost < flag, `the cost line is at ${cost} and the first flag row at ${flag}`);
  /* Or the rows are a second flag list rather than a statement of what the verb is for. */
  for (const label of labels(lines.join("\n"))) {
    const row = lines.find((line) => line.trimStart().startsWith(`${label} `));
    const words = new Set(row.split(/\W+/u).filter((word) => word.length > 4));
    for (const flagRow of lines.filter((line) => line.startsWith("  --"))) {
      const shared = flagRow.split(/\W+/u).filter((word) => words.has(word));
      assert.ok(shared.length < 3, `"${label}" restates ${flagRow.trim()}: ${shared.join(", ")}`);
    }
  }
});

test("collect and pending each answer for themselves, and each says what it costs", async () => {
  const collect = await helpText("collect");
  assert.match(collect, /Usage: forge chatgpt collect <id> \[--wait s\]/u);
  assert.match(collect, /costing no turn/u);
  const pending = await helpText("pending");
  assert.match(pending, /Usage: forge chatgpt pending \[--drop id\]/u);
  assert.match(pending, /--drop id/u);
});

/* Four actions, four flag sets, and until ISS-932 a flag of one was reported as a flag this verb has
   not got. The command each refusal hands over is the sibling action's own usage line and nothing
   written beside it, so `image`'s required --ratio is named once. No turn is sent to learn any of it. */
test("a flag of a sibling action is refused as that action's, with the call that reaches it", async () => {
  const ratio = await ran("ask", "x", "--ratio", "16:9");
  assert.equal(ratio.status, 1);
  assert.doesNotMatch(ratio.stderr, /No chatgpt ask flag named --ratio/u);
  assert.match(ratio.stderr, /^ {2}forge chatgpt image "<prompt>" --ratio w:h$/mu);
  const file = await ran("image", "x", "--file", "a.png");
  assert.equal(file.status, 1);
  assert.match(file.stderr, /^ {2}forge chatgpt ask "<prompt>" --file path$/mu);
  const drop = await ran("collect", "abc", "--drop", "abc");
  assert.equal(drop.status, 1);
  assert.match(drop.stderr, /^ {2}forge chatgpt pending --drop id$/mu);
  assert.equal(calls.length, 0, "and no turn was spent on any of them");
});

/* A flag where the prompt belongs is two mistakes, and the stranger is the one worth naming. */
test("a stranger flag standing in the prompt's place is named, and a real one still misses the prompt", async () => {
  const stranger = await ran("ask", "--zzz", "x");
  assert.equal(stranger.status, 1);
  assert.match(stranger.stderr, /No chatgpt ask flag named --zzz\. The set is/u);
  const missing = await ran("ask", "--model", "gpt-5.6");
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /the prompt comes first/u);
  assert.equal(calls.length, 0);
});
