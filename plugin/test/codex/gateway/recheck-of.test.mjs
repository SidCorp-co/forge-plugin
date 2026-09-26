/* A recheck pinned by `--of`: the consult it answers is named by id, and with no file named the set
   that consult recorded is what travels, so a recheck taken after a commit emptied the turn record
   needs no copy of that set typed back (ISS-378). End to end, because the set, the consult and the
   verdict are settled across the verb and no unit reaches all three. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, tempRoom } from "../../fixtures.mjs";
import { repoRoot } from "../../../src/git/repo-root.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const standIn = async (answer) => {
  const { createServer } = await import("node:http");
  const sse = (events) => events.map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join("");
  const sent = [];
  const server = createServer((req, res) => {
    req.setEncoding("utf8");
    req.on("data", (chunk) => sent.push(chunk));
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
  return { port: server.address().port, close: () => server.close(), shown: () => sent.join("") };
};

/* A committed checkout holding the two files, so the tree differs from HEAD in nothing. */
const checkout = () => {
  const room = tempRoom("codex-recheck-of-");
  spawnSync("git", ["init", "-q", room], { cwd: room });
  writeFileSync(join(room, "judged.txt"), "reviewed, and fixed\n");
  writeFileSync(join(room, "other.txt"), "another file\n");
  git(room, "add", ".");
  git(room, "commit", "-qm", "the fix, committed");
  return room;
};

const FINDING = "CODEX: 1 findings\n- **F1 — New — major:** `judged.txt:1` — the line is wrong.";

const consultRow = (root, fields) => ({
  kind: "consult", ok: true, root, repo: root, at: "2026-09-26T10:00:00.000Z", send: "bodies", ...fields,
});

const seeded = (rows, turn = null) => {
  const home = tempRoom("codex-recheck-of-home-");
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), rows.map((one) => `${JSON.stringify(one)}\n`).join(""));
  if (turn) writeFileSync(join(home, "forge", "codex.json"), JSON.stringify({ turns: { [turn.root]: { files: turn.files, at: Date.now() } } }));
  return home;
};

const forge = async (cwd, home, argv, answer = "1. REFUTED — it is fixed.\n\nCODEX: 0 findings") => {
  const gateway = await standIn(answer);
  writeFileSync(join(home, "proxy.env"), [
    `export ANTHROPIC_BASE_URL="http://127.0.0.1:${gateway.port}"`,
    "ANTHROPIC_AUTH_TOKEN=sk-stand-in",
    'ANTHROPIC_DEFAULT_FABLE_MODEL="cx/gpt-5.6-sol"',
  ].join("\n"));
  try {
    /* Spawned rather than spawnSync'd: the stand-in listens on this event loop. */
    const child = spawn(FORGE, ["codex", ...argv],
      { cwd, env: { ...process.env, HOME: home, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "proxy.env") } });
    child.stdin.end("the fix is in");
    let said = "";
    child.stderr.on("data", (one) => { said += one; });
    child.stdout.on("data", (one) => { said += one; });
    const status = await new Promise((done) => child.on("close", done));
    return { status, said, shown: gateway.shown() };
  } finally {
    gateway.close();
  }
};

const rowsOf = (home) => readFileSync(join(home, "forge", "codex-log.jsonl"), "utf8")
  .split("\n").filter(Boolean).map((one) => JSON.parse(one));

const recheckRow = (home) => rowsOf(home).find((one) => one.kind === "consult" && one.recheck);

test("a recheck given --of and no file sends the set that consult recorded, whatever the turn record holds", async () => {
  const room = checkout();
  const root = repoRoot(room);
  const home = seeded([consultRow(root, { id: "c1", files: ["judged.txt"], reply: FINDING })], { root, files: ["other.txt"] });
  const { status, said, shown } = await forge(room, home, ["consult", "--recheck", "--of", "c1", "--rounds", "1"]);
  assert.equal(status, 0, said);
  assert.match(said, /a recheck of c1, so the 1 file\(s\) it recorded travel\./u, "the ground it selected on is said");
  assert.deepEqual(recheckRow(home).files, ["judged.txt"], "the recorded set travelled, and the turn record's file did not");
  assert.ok(!shown.includes("### other.txt"), "the turn record's file never reached the reviewer");
});

test("a recheck given --of and a file sends that file alone", async () => {
  const room = checkout();
  const root = repoRoot(room);
  const home = seeded([consultRow(root, { id: "c1", files: ["judged.txt", "other.txt"], reply: FINDING })]);
  const { status, said } = await forge(room, home, ["consult", "--recheck", "--of", "c1", "--rounds", "1", "judged.txt"]);
  assert.equal(status, 0, said);
  assert.deepEqual(recheckRow(home).files, ["judged.txt"], "the named file, not the two the consult recorded");
});

test("a recheck given --of answers that consult where a newer one shares its file, and records the verdict on it", async () => {
  const room = checkout();
  const root = repoRoot(room);
  const newer = consultRow(root, { id: "c2", at: "2026-09-26T11:00:00.000Z", files: ["judged.txt"], reply: "CODEX: 0 findings" });
  const home = seeded([consultRow(root, { id: "c1", files: ["judged.txt"], reply: FINDING }), newer]);
  const { status, said, shown } = await forge(room, home, ["consult", "--recheck", "--of", "c1", "--rounds", "1"]);
  assert.equal(status, 0, said);
  assert.match(shown, /Your earlier finding F1 still stands/u, "c1's finding went to the reviewer, where c2 has none to send");
  const verdict = rowsOf(home).find((one) => one.kind === "verdict");
  assert.equal(verdict?.of, "c1", "the recheck's ruling is recorded against the consult --of named");
  assert.deepEqual(verdict.kept, ["F1"]);
});

test("a recheck given --of from a linked worktree finds the consult a sibling worktree answered", async () => {
  const primary = checkout();
  const sibling = join(tempRoom("codex-recheck-of-sibling-"), "wt");
  git(primary, "worktree", "add", "-q", sibling);
  const home = seeded([consultRow(repoRoot(primary), { id: "c1", files: ["judged.txt"], reply: FINDING })]);
  const { status, said } = await forge(sibling, home, ["consult", "--recheck", "--of", "c1", "--rounds", "1"]);
  assert.equal(status, 0, said);
  assert.equal(recheckRow(home).root, repoRoot(sibling), "the recheck ran in the worktree it was asked from");
  assert.equal(rowsOf(home).find((one) => one.kind === "verdict")?.of, "c1", "and answered the sibling's consult");
});

test("an --of naming no answered consult here is refused by that id, and one without --recheck is refused", async () => {
  const room = checkout();
  const home = seeded([consultRow(repoRoot(room), { id: "c1", files: ["judged.txt"], reply: FINDING })]);
  const unknown = await forge(room, home, ["consult", "--recheck", "--of", "zz9", "--rounds", "1"]);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.said, /no answered consult in \S+ carries the id zz9/u);
  const bare = await forge(room, home, ["consult", "--of", "c1", "--rounds", "1", "judged.txt"]);
  assert.notEqual(bare.status, 0);
  assert.match(bare.said, /--of takes --recheck/u);
  assert.equal(rowsOf(home).length, 1, "neither refusal logged a consult");
});

/* The recorded set is the consult's word and not the caller's: a file that consult saw, deleted and
   committed since, is in neither the tree nor HEAD, and a named path there is refused as a typo. */
test("a recheck given --of keeps a recorded file whose deletion was committed since", async () => {
  const room = checkout();
  const root = repoRoot(room);
  const head = git(room, "rev-parse", "HEAD").stdout.trim();
  git(room, "rm", "-q", "other.txt");
  git(room, "commit", "-qm", "the file the finding was about, deleted");
  const reply = "CODEX: 1 findings\n- **F1 — New — major:** `other.txt:1` — the file should not exist.";
  const home = seeded([consultRow(root, { id: "c1", head, files: ["judged.txt", "other.txt"], reply })]);
  const { status, said } = await forge(room, home, ["consult", "--recheck", "--of", "c1", "--rounds", "1"]);
  assert.equal(status, 0, said);
  assert.deepEqual(recheckRow(home).files, ["judged.txt", "other.txt"], "the deletion travelled as the anchor's diff shows it");
});

test("consult -h lists --of", async () => {
  const room = checkout();
  const { said } = await forge(room, seeded([]), ["consult", "-h"]);
  assert.match(said, /^ {2}--of <id> {6}the answered consult a recheck pins by id, in any worktree of this repository;/mu);
});
