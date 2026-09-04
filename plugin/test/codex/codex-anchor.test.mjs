/* The verb builds the reviewer's scope, and no unit reaches that: only a consult that runs proves
   the reviewer is handed this consult's own anchor rather than the tree at HEAD. Its own file
   because it stands up a gateway, which the rest of the suite does not. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tempRoom } from "../fixtures.mjs";

/* A stand-in gateway asks for `git_diff` with no arguments on its first call and answers on its
   second; what the tool returned is on the log row, and its size says which of the two possible
   diffs it got (ISS-51). */
const standIn = async (answerCalls) => {
  const { createServer } = await import("node:http");
  const sse = (events) => events.map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join("");
  const asked = { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t1", name: "git_diff" } };
  let call = 0;
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      call += 1;
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(sse([
        { type: "message_start", message: { usage: { input_tokens: 1 } } },
        ...(call === 1
          ? [asked, { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{}" } },
            { type: "content_block_stop", index: 0 }]
          : [{ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: answerCalls } }]),
        { type: "message_delta", delta: { stop_reason: call === 1 ? "tool_use" : "end_turn" }, usage: { output_tokens: 1 } },
      ]));
    });
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  return { port: server.address().port, close: () => server.close() };
};

test("a recheck's reviewer is handed the head its findings were made against, not HEAD", async () => {
  const room = tempRoom("codex-anchor-");
  const home = tempRoom("codex-anchor-home-");
  const git = (...argv) => spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", room]);
  writeFileSync(join(room, "judged.txt"), "reviewed\n");
  writeFileSync(join(room, "elsewhere.txt"), "not this consult's business\n");
  git("add", ".");
  git("commit", "-qm", "one");
  const head = git("rev-parse", "HEAD").stdout.trim();
  /* The rechecked file is exactly as the findings were made against it; another file is not, and
     the whole checkout at HEAD is the answer that would carry it in. */
  writeFileSync(join(room, "elsewhere.txt"), `${"a change the recheck is not about\n".repeat(40)}`);

  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), `${JSON.stringify({
    kind: "consult", id: "c1", ok: true, root: room, at: "2026-09-04T10:00:00.000Z", head,
    files: ["judged.txt"], send: "diffs",
    reply: "CODEX: 1 findings\n- **F1 — New — major:** `judged.txt:1` — the line is wrong.",
  })}\n`);

  const gateway = await standIn("1. REFUTED — it is fixed.\n\nCODEX: 0 findings");
  writeFileSync(join(home, "proxy.env"), [
    `export ANTHROPIC_BASE_URL="http://127.0.0.1:${gateway.port}"`,
    "ANTHROPIC_AUTH_TOKEN=sk-stand-in",
    'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
  ].join("\n"));
  /* Spawned rather than spawnSync'd: the stand-in listens on this event loop, and a blocking child
     would leave it unable to answer the consult it is waiting on. */
  const child = spawn(new URL("../../bin/forge", import.meta.url).pathname,
    ["codex", "consult", "--recheck", "--rounds", "2", "judged.txt"],
    { cwd: room, env: { ...process.env, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env") } });
  child.stdin.end("the fix is in");
  let said = "";
  child.stderr.on("data", (one) => { said += one; });
  child.stdout.resume();
  const status = await new Promise((done) => child.on("close", done));
  gateway.close();
  assert.equal(status, 0, said);
  const rows = readFileSync(join(home, "forge", "codex-log.jsonl"), "utf8")
    .split("\n").filter(Boolean).map((one) => JSON.parse(one));
  const ran = rows.find((one) => one.kind === "consult" && one.id !== "c1" && one.tools?.length);
  assert.ok(ran, "the recheck answered and logged what its reviewer ran");
  assert.deepEqual(ran.tools[0], { name: "git_diff", input: {}, chars: ran.tools[0].chars, error: false });
  assert.equal(
    ran.tools[0].chars,
    `no change against ${head} in the file(s) this consult named`.length,
    "the rechecked file is unmoved since that head, and the answer says so rather than handing over the tree",
  );
});
