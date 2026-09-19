/* Which state the checkout's declared check left a round in, end to end, because no unit reaches it:
   the state is written where the tool runs, read where the row is logged, and what a run actually
   sees is the process's own stderr. A review given by inspection alone and one that executed the
   suite read the same everywhere else, so each arm below asserts the row and the line together
   (ISS-1898). In this directory because it stands up a gateway and spawns the CLI against it, which
   is what everything here does and what nothing in the sibling units does. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tempRoom } from "../../fixtures.mjs";

/* `calls` is what the reviewer asks for on its first call, by name; the second answers in text. A
   `fail` arm answers the second call with a 500, which is a consult that dies after its round has
   already done whatever it did with the check. */
const standIn = async (answer, { calls = [], fail = false } = {}) => {
  const { createServer } = await import("node:http");
  const sse = (events) => events.map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join("");
  let call = 0;
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      call += 1;
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
  return { port: server.address().port, close: () => server.close() };
};

/* One consult in a checkout of its own, answered by a stand-in, returning the row it logged and
   every line the run would have read on its console. */
const consulted = async (label, { check = null, calls = [], fail = false } = {}) => {
  const room = tempRoom(`codex-check-${label}-`);
  const home = tempRoom(`codex-check-${label}-home-`);
  const git = (...argv) => spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { cwd: room, encoding: "utf8" });
  spawnSync("git", ["init", "-q", room], { cwd: dirname(room) });
  writeFileSync(join(room, "judged.txt"), "the file under review\n");
  writeFileSync(join(room, ".forge.json"), JSON.stringify(check ? { codex: check } : {}));
  git("add", ".");
  git("commit", "-qm", "one");

  mkdirSync(join(home, "forge"), { recursive: true });
  const gateway = await standIn("CODEX: 0 findings", { calls, fail });
  writeFileSync(join(home, "proxy.env"), [
    `export ANTHROPIC_BASE_URL="http://127.0.0.1:${gateway.port}"`,
    "ANTHROPIC_AUTH_TOKEN=sk-stand-in",
    'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
  ].join("\n"));
  const child = spawn(new URL("../../../bin/forge", import.meta.url).pathname,
    ["codex", "consult", "--rounds", "2", "judged.txt"],
    { cwd: room, env: { ...process.env, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env") } });
  child.stdin.end("what this turn did");
  let said = "";
  child.stderr.on("data", (one) => { said += one; });
  child.stdout.resume();
  await new Promise((done) => child.on("close", done));
  gateway.close();
  const rows = readFileSync(join(home, "forge", "codex-log.jsonl"), "utf8")
    .split("\n").filter(Boolean).map((one) => JSON.parse(one));
  return { row: rows.findLast((one) => one.kind === "consult"), said, home, room };
};

test("a review that declined the offered check says so where the run reads what the round cost", async () => {
  const { row, said } = await consulted("declined", { check: { check: "true" } });
  assert.equal(row.ok, true, said);
  assert.equal(row.check, "declined");
  assert.equal(row.checkCommand, "true");
  assert.match(said, /codex: check declined — `true` was offered and not run: this review is inspection, not execution\./u, said);
});

test("a review that ran the check says so, whatever the command exited", async () => {
  const { row, said } = await consulted("ran", { check: { check: "exit 3" }, calls: ["run_check"] });
  assert.equal(row.check, "ran", said);
  assert.equal(row.checkCommand, "exit 3");
  assert.match(said, /codex: check ran — `exit 3`\./u, said);
});

test("a check stopped at its clock is cut, and is not read as a review that ran one", async () => {
  const { row, said } = await consulted("cut", { check: { check: "sleep 30", checkMs: 300 }, calls: ["run_check"] });
  assert.equal(row.check, "cut", said);
  assert.match(said, /codex: check cut — `sleep 30` was stopped at its clock, so none of it reached this review\./u, said);
});

test("a checkout that declared no check records none and says nothing about one", async () => {
  const { row, said } = await consulted("none");
  assert.equal(row.check, "none", said);
  assert.equal(Object.hasOwn(row, "checkCommand"), false, "there is no command to record");
  assert.doesNotMatch(said, /codex: check /u, said);
});

test("a consult that died after its check ran still records that the round ran it", async () => {
  const { row, said } = await consulted("failed-consult", { check: { check: "exit 0" }, calls: ["run_check"], fail: true });
  assert.equal(row.ok, false, said);
  assert.equal(row.check, "ran", "the row a failure writes carries what the round reached, not a blank");
  assert.equal(row.checkCommand, "exit 0");
  assert.match(said, /codex: check ran — `exit 0`\./u, said);
});
