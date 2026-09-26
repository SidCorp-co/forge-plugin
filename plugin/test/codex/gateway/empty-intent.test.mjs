/* What a consult says about an intent that came out empty, end to end, because the ways it comes out
   empty are shapes of a real stdin and the line a run reads is the process's own stderr: a pipe that
   closed with nothing on it ran silent and still answered `0 findings` (ISS-471). In this directory
   because it stands up a gateway and spawns the CLI against it. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, projectRecord, tempRoom } from "../../fixtures.mjs";

const standIn = async (answer) => {
  const { createServer } = await import("node:http");
  const sse = (events) => events.map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join("");
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(sse([
        { type: "message_start", message: { usage: { input_tokens: 1 } } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: answer } },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } },
      ]));
    });
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  return { port: server.address().port, close: () => server.close() };
};

/* `stdin` is what the child's stdin is fed and then closed with, or null for a pipe left open and
   silent, which is the deadline's case. */
const consulted = async (label, stdin) => {
  const room = tempRoom(`codex-intent-${label}-`);
  const home = tempRoom(`codex-intent-${label}-home-`);
  spawnSync("git", ["init", "-q", room], { cwd: room });
  writeFileSync(join(room, "judged.txt"), "the file under review\n");
  git(room, "add", ".");
  git(room, "commit", "-qm", "one");
  writeFileSync(join(room, "judged.txt"), "changed\n");
  projectRecord(room, home, {});
  mkdirSync(join(home, "forge"), { recursive: true });
  const gateway = await standIn("CODEX: 0 findings");
  writeFileSync(join(home, "proxy.env"), [
    `export ANTHROPIC_BASE_URL="http://127.0.0.1:${gateway.port}"`,
    "ANTHROPIC_AUTH_TOKEN=sk-stand-in",
    'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
  ].join("\n"));
  const child = spawn(new URL("../../../bin/forge", import.meta.url).pathname,
    ["codex", "consult", "--rounds", "1", "judged.txt"],
    { cwd: room, env: { ...process.env, HOME: home, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env") } });
  if (stdin !== null) child.stdin.end(stdin);
  let said = "";
  let out = "";
  child.stderr.on("data", (one) => { said += one; });
  child.stdout.on("data", (one) => { out += one; });
  const status = await new Promise((done) => child.on("close", done));
  gateway.close();
  const rows = readFileSync(join(home, "forge", "codex-log.jsonl"), "utf8")
    .split("\n").filter(Boolean).map((one) => JSON.parse(one));
  return { status, said, out, row: rows.findLast((one) => one.kind === "consult") };
};

const NO_INTENT = /carries no intent/u;
const CLOSED = /codex: stdin closed with nothing on it, so the consult carries no intent\. Pipe it: echo /u;

for (const [label, stdin] of [["closed-empty", ""], ["whitespace", "  \n\t\n"]]) {
  test(`a consult whose stdin closes ${label} says it carries no intent, and still runs to its verdict`, async () => {
    const run = await consulted(label, stdin);
    assert.match(run.said, CLOSED, run.said);
    assert.doesNotMatch(run.said, /inside \d+ms/u, "the deadline did not pass, so the line does not say it did");
    assert.equal(run.status, 0, run.said);
    assert.match(run.out, /CODEX: 0 findings/u, "the review still ran");
    assert.equal(run.row?.ok, true, run.said);
    assert.equal(run.row.intent, "", "and its row records the intent it carried, which was none");
  });
}

test("a consult whose stdin stays open and silent past the deadline says so by the deadline", async () => {
  const run = await consulted("silent", null);
  assert.match(run.said, /codex: nothing on stdin inside \d+ms, so the consult carries no intent\./u, run.said);
  assert.doesNotMatch(run.said, CLOSED);
  assert.equal(run.row?.ok, true, run.said);
  assert.equal(run.row.intent, "");
});

test("a consult carrying an intent says nothing about an intent it lacks", async () => {
  const run = await consulted("carried", "what this turn did\n");
  assert.doesNotMatch(run.said, NO_INTENT, run.said);
  assert.equal(run.row?.ok, true, run.said);
  assert.equal(run.row.intent, "what this turn did");
});
