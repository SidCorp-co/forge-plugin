/* The repository a consult row carries is written by the consult itself, end to end, because the
   readers that find a consult from a sibling worktree read that field and no unit writes the real
   row (ISS-898). In this directory because it stands up a gateway and spawns the CLI against it. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, projectRecord, tempRoom } from "../../fixtures.mjs";
import { repoRoot } from "../../../src/git/repo-root.mjs";

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

test("a consult taken in a linked worktree carries the primary checkout as its repository", async () => {
  const primary = tempRoom("codex-stamp-primary-");
  const home = tempRoom("codex-stamp-home-");
  spawnSync("git", ["init", "-q", primary], { cwd: primary });
  writeFileSync(join(primary, "judged.txt"), "the file under review\n");
  git(primary, "add", ".");
  git(primary, "commit", "-qm", "one");
  const sibling = join(tempRoom("codex-stamp-sibling-"), "wt");
  git(primary, "worktree", "add", "-q", sibling);
  writeFileSync(join(sibling, "judged.txt"), "changed in the worktree\n");
  projectRecord(sibling, home, {});

  mkdirSync(join(home, "forge"), { recursive: true });
  const gateway = await standIn("CODEX: 0 findings");
  writeFileSync(join(home, "proxy.env"), [
    `export ANTHROPIC_BASE_URL="http://127.0.0.1:${gateway.port}"`,
    "ANTHROPIC_AUTH_TOKEN=sk-stand-in",
    'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
  ].join("\n"));
  const child = spawn(new URL("../../../bin/forge", import.meta.url).pathname,
    ["codex", "consult", "--rounds", "1", "judged.txt"],
    { cwd: sibling, env: { ...process.env, HOME: home, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env") } });
  child.stdin.end("what this turn did");
  let said = "";
  child.stderr.on("data", (one) => { said += one; });
  child.stdout.resume();
  await new Promise((done) => child.on("close", done));
  gateway.close();
  const rows = readFileSync(join(home, "forge", "codex-log.jsonl"), "utf8")
    .split("\n").filter(Boolean).map((one) => JSON.parse(one));
  const row = rows.findLast((one) => one.kind === "consult");
  assert.equal(row?.ok, true, said);
  assert.equal(row.root, repoRoot(sibling), "the checkout it stood in stays the row's root");
  assert.equal(row.repo, repoRoot(primary), "and the repository is the primary checkout the worktree was added from");
});
