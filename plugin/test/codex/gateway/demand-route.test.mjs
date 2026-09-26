/* The route a demand refusal prints is run as a caller would run it, against a stand-in gateway, and
   the refused call is then sent again: a command naming the first six of eight recorded files cleared
   six and was refused for the rest, one paid consult per six (ISS-91). In this directory because it
   stands up a gateway and spawns the CLI against it. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

import { answered, callHook, git, projectRecord, tempRoom } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const hookAt = (name) => new URL(`../../../hooks/entries/codex/${name}.mjs`, import.meta.url).pathname;
/* Eight, so a route cut at six leaves two behind. */
const FILES = ["a.md", "b.md", "c.md", "d.md", "e.md", "f.md", "g.md", "h.md"];

const standIn = async () => {
  const sse = (events) => events.map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join("");
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(sse([
        { type: "message_start", message: { usage: { input_tokens: 1 } } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "CODEX: 0 findings" } },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } },
      ]));
    });
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  return { port: server.address().port, close: () => server.close() };
};

/* A checkout with one commit, eight recorded documents written since, and a home whose `forge` on
   PATH is this checkout's, so the printed command runs verbatim. */
const room = async (project, files = FILES) => {
  const repo = realpathSync(tempRoom("demand-route-repo-"));
  const home = realpathSync(tempRoom("demand-route-home-"));
  git(repo, "init", "-q");
  writeFileSync(join(repo, "README.md"), "base\n");
  git(repo, "add", ".");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "base");
  for (const rel of files) writeFileSync(join(repo, rel), `# ${rel}\n`);
  projectRecord(repo, home, project);
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex.json"),
    JSON.stringify({ turns: { [repo]: { files, at: Date.now() - 90_000 } } }));
  const gateway = await standIn();
  writeFileSync(join(home, "proxy.env"), [
    `export ANTHROPIC_BASE_URL="http://127.0.0.1:${gateway.port}"`,
    "ANTHROPIC_AUTH_TOKEN=sk-stand-in",
    'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
  ].join("\n"));
  const bin = join(home, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "forge"), `#!/bin/sh\nexec "${FORGE}" "$@"\n`);
  chmodSync(join(bin, "forge"), 0o755);
  const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env"),
    PATH: `${bin}:${process.env.PATH}` };
  const ask = (hook, command) => answered(callHook(hookAt(hook),
    { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, session_id: "s-route", cwd: repo }, env));
  /* Asynchronous, since the stand-in answers from this same process and a blocked loop answers nothing. */
  const run = (command) => new Promise((done) => {
    const child = spawn("bash", ["-c", command], { cwd: repo, env });
    let stderr = "";
    child.stderr.on("data", (one) => { stderr += one; });
    child.stdout.resume();
    child.on("close", (status) => done({ status, stderr }));
  });
  return { repo, ask, run, close: gateway.close };
};

const because = (out) => out?.hookSpecificOutput?.permissionDecisionReason ?? "";
const route = (said, verb) => {
  const [, command] = said.match(new RegExp(`\`((?:[^\`]*\\| )?${verb} [^\`]*)\``, "u")) ?? [];
  assert.ok(command, `the refusal prints a ${verb} command: ${said}`);
  return command;
};
const shown = (said) => said.match(/\(([^()]*), recorded /u)?.[1] ?? "";

test("the consult a commit refusal prints clears every recorded file it stages, and the commit then goes through", async () => {
  const at = await room({});
  try {
    git(at.repo, "add", "--", ...FILES);
    const said = because(at.ask("codex-second", "git commit -m x"));
    assert.match(shown(said), / and 2 more$/u, "the sentence shows six names and counts the rest");
    const ran = await at.run(route(said, "forge codex consult"));
    assert.equal(ran.status, 0, ran.stderr);
    assert.equal(at.ask("codex-second", "git commit -m x"), null,
      `one run of the printed command leaves nothing for the same commit to wait on: ${because(at.ask("codex-second", "git commit -m x"))}`);
  } finally {
    at.close();
  }
});

test("the staging a commit refusal prints takes every staged copy apart from the disk", async () => {
  const at = await room({});
  try {
    git(at.repo, "add", "--", ...FILES);
    for (const rel of FILES) writeFileSync(join(at.repo, rel), `# ${rel}, changed on disk\n`);
    const said = because(at.ask("codex-second", "git commit -m x"));
    assert.match(said, /^Stage what was read/u, said);
    const ran = await at.run(route(said, "git add"));
    assert.equal(ran.status, 0, ran.stderr);
    const next = because(at.ask("codex-second", "git commit -m x"));
    assert.doesNotMatch(next, /staged copy of/u, `no staged copy is left apart from the disk: ${next}`);
  } finally {
    at.close();
  }
});

test("the consult a gate-door refusal prints clears the whole record, and the gate then runs", async () => {
  const at = await room({ slug: "fixture", codex: { owed: ["gate"] }, stats: { commands: { gate: "npm run check" } } });
  try {
    const said = because(at.ask("codex-owed", "npm run check"));
    assert.match(shown(said), / and 2 more$/u, "the sentence shows six names and counts the rest");
    const ran = await at.run(route(said, "forge codex consult"));
    assert.equal(ran.status, 0, ran.stderr);
    assert.equal(at.ask("codex-owed", "npm run check"), null,
      `one run of the printed command clears the door: ${because(at.ask("codex-owed", "npm run check"))}`);
  } finally {
    at.close();
  }
});

test("a recorded name opening with a hyphen is spelled as a path in the command, which the CLI then reads as one", async () => {
  const lead = ["-lead.md", "a.md"];
  const at = await room({}, lead);
  try {
    git(at.repo, "add", "--", ...lead);
    const consult = route(because(at.ask("codex-second", "git commit -m x")), "forge codex consult");
    assert.match(consult, / \.\/-lead\.md(?: |$)/u, `not bare, which the CLI would take for a flag: ${consult}`);
    const ran = await at.run(consult);
    assert.equal(ran.status, 0, ran.stderr);
    assert.equal(at.ask("codex-second", "git commit -m x"), null, "and the consult it ran cleared that path");
  } finally {
    at.close();
  }
});
