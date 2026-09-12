/* The half of this verb that sends nothing: what a caller reads before spending a turn, and the
   refusal a flag in the prompt's place gets. Split off when the suite beside it passed max-lines. */
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
const helpText = async () => {
  const run = await ran("-h");
  assert.equal(run.status, 0);
  assert.equal(calls.length, 0, "asking what to type sends no turn");
  return run.stdout;
};

const labels = (said) => said.split("\n")
  .filter((line) => /^ {2}\S/u.test(line) && !line.trim().startsWith("--"))
  .map((line) => line.trim().split(/ {2,}/u)[0]);

test("-h states the one attempt, the cap and the deadline in force", async () => {
  const said = await helpText();
  assert.match(said, /One attempt per call and never a second/u);
  /* Never that it was spent: a timeout cannot say either way, and a line claiming the turn is gone
     would have a caller abandon work that may never have run. */
  assert.match(said, /may still have spent a metered turn/u);
  assert.doesNotMatch(said, /does not refund/u);
  assert.match(said, /up to 10/u);
  assert.match(said, /no default is sent/u);
  assert.match(said, /The wait is \d+s, from waitSeconds in config\.json; --wait sets this call's alone\./u,
    "the line naming where the wait comes from is the line that names the flag setting one call's");
});

/* Pinned by name, so dropping a row goes red here rather than passing as a shorter help text. The
   flag set is pinned beside them because a flag is the only handle this suite has on a use case
   arriving: a fifth turns this red, and whether it earns a row is judged then rather than never. */
test("-h carries one row per use case, and the flags that reach them are those five", async () => {
  const said = await helpText();
  assert.deepEqual(labels(said), ["an answer", "a picture", "a follow-up"]);
  assert.deepEqual([...new Set(said.match(/--[a-z]+/gu))],
    ["--resume", "--model", "--file", "--save", "--wait"], "a flag added here owes the rows above another look");
});

test("the follow-up row carries the arithmetic and the picture row says what it is not", async () => {
  const said = await helpText();
  const rowFor = (name) => said.split("\n").find((line) => line.trimStart().startsWith(`${name} `));
  assert.match(rowFor("a follow-up"), /one turn and not two/u);
  assert.match(rowFor("a picture"), /never a render of what you built/u);
});

/* A reader who meets the cost after the flags has already decided, and one who scrolls stops. */
test("the cost stands above the flag rows, and -h is one screen", async () => {
  const lines = (await helpText()).split("\n");
  assert.ok(lines.length <= 24, `-h runs to ${lines.length} lines, which is past one screen`);
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

/* A flag where the prompt belongs is two mistakes, and the stranger is the one worth naming. */
test("a stranger flag standing in the prompt's place is named, and a real one still misses the prompt", async () => {
  const stranger = await ran("--zzz", "x");
  assert.equal(stranger.status, 1);
  assert.match(stranger.stderr, /No chatgpt flag named --zzz\. The set is/u);
  const missing = await ran("--model", "gpt-5.6");
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /the prompt comes first/u);
  assert.equal(calls.length, 0);
});
