/* What one consult sends and logs, end to end, because no unit reaches it: the request is built where
   the tools are, the row where the round ends, and what a run sees is the process's own stderr. In
   this directory because it stands up a gateway and spawns the CLI against it, which is what
   everything here does and what nothing in the sibling units does. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { projectRecord, tempRoom } from "../../fixtures.mjs";

/* `calls` is what the reviewer asks for on its first call, by name; the second answers in text. A
   `fail` arm answers the second call with a 500, which is a consult that dies after its round has
   already run a tool. Every request body is kept, so a case can read what the reviewer was offered. */
const standIn = async (answer, { calls = [], fail = false } = {}) => {
  const { createServer } = await import("node:http");
  const sse = (events) => events.map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join("");
  let call = 0;
  const asked = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (one) => { body += one; });
    req.on("end", () => {
      call += 1;
      asked.push(JSON.parse(body || "{}"));
      if (fail && call === 2) {
        res.writeHead(500, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: { message: "the gateway gave up" } }));
      }
      const asking = call === 1 ? calls : [];
      res.writeHead(200, { "content-type": "text/event-stream" });
      return res.end(sse([
        { type: "message_start", message: { usage: { input_tokens: 1 } } },
        ...asking.flatMap((name, at) => [
          { type: "content_block_start", index: at, content_block: { type: "tool_use", id: `t${at}`, name } },
          { type: "content_block_delta", index: at, delta: { type: "input_json_delta", partial_json: "{}" } },
          { type: "content_block_stop", index: at },
        ]),
        ...(asking.length ? [] : [{ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: answer } }]),
        { type: "message_delta", delta: { stop_reason: asking.length ? "tool_use" : "end_turn" }, usage: { output_tokens: 1 } },
      ]));
    });
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  return { port: server.address().port, asked, close: () => server.close() };
};

/* One consult in a checkout of its own, answered by a stand-in, returning the row it logged and
   every line the run would have read on its console. */
const consulted = async (label, { codex = null, calls = [], fail = false } = {}) => {
  const room = tempRoom(`codex-row-${label}-`);
  const home = tempRoom(`codex-row-${label}-home-`);
  const git = (...argv) => spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { cwd: room, encoding: "utf8" });
  spawnSync("git", ["init", "-q", room], { cwd: dirname(room) });
  writeFileSync(join(room, "judged.txt"), "the file under review\n");
  git("add", ".");
  git("commit", "-qm", "one");
  /* The project's keys are this machine's record of them now, under the configuration home the
     child is handed rather than in the tree it reviews. */
  projectRecord(room, home, codex ? { codex } : {});

  mkdirSync(join(home, "forge"), { recursive: true });
  const gateway = await standIn("CODEX: 0 findings", { calls, fail });
  writeFileSync(join(home, "proxy.env"), [
    `export ANTHROPIC_BASE_URL="http://127.0.0.1:${gateway.port}"`,
    "ANTHROPIC_AUTH_TOKEN=sk-stand-in",
    'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
  ].join("\n"));
  const child = spawn(new URL("../../../bin/forge", import.meta.url).pathname,
    ["codex", "consult", "--rounds", "2", "judged.txt"],
    { cwd: room, env: { ...process.env, HOME: home, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env") } });
  child.stdin.end("what this turn did");
  let said = "";
  child.stderr.on("data", (one) => { said += one; });
  child.stdout.resume();
  await new Promise((done) => child.on("close", done));
  gateway.close();
  const rows = readFileSync(join(home, "forge", "codex-log.jsonl"), "utf8")
    .split("\n").filter(Boolean).map((one) => JSON.parse(one));
  return { row: rows.findLast((one) => one.kind === "consult"), said, asked: gateway.asked };
};

/* The landing gates every change, so a reviewer running the project's gate measures nothing the
   landing will not: a checkout naming `codex.check` still hands the reviewer no command to run. */
test("a consult offers the reviewer no check to run, even where the checkout names one", async () => {
  const { row, said, asked } = await consulted("no-check", { codex: { check: "npm test" } });
  assert.equal(row.ok, true, said);
  assert.ok(asked.length > 0 && asked[0].tools.some((one) => one.name === "read_file"), "the reviewer keeps its read tools");
  for (const body of asked) assert.doesNotMatch(JSON.stringify(body), /run_check/u, "no request offers or names the tool");
  assert.equal(Object.hasOwn(row, "check"), false, "and the row records no check state");
  assert.doesNotMatch(said, /codex: check /u, said);
});

/* ISS-2932: what the gateway answered is read off a field, never out of the error's prose, by the
   writes and doors that let an unavailable gateway's consult through. */
test("a consult the gateway answered with an HTTP error logs that status in a field of its own", async () => {
  const { row, said } = await consulted("status", { calls: ["read_file"], fail: true });
  assert.equal(row.ok, false, said);
  assert.equal(row.status, 500, "the HTTP status, as a number beside the text");
  assert.match(row.error, /^gateway answered 500:/u, "and the error's text as it was");
});
