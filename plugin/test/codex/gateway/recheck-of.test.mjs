/* A recheck pinned by `--of`: the consult it answers is named by id, and with no file named the set
   that consult recorded is what travels, so a recheck taken after a commit emptied the turn record
   needs no copy of that set typed back (ISS-378). Named by an issue key instead, it answers the last
   consult naming that key (ISS-2358). End to end, because the set, the consult and the verdict are
   settled across the verb and no unit reaches all three. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, tempRoom } from "../../fixtures.mjs";
import { repoRoot } from "../../../src/git/repo-root.mjs";
import { digest } from "../../../src/codex/codex-api.mjs";

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

/* A refutation is "fixed, or never real", and the bytes are what tell the two apart (ISS-2641). */
test("a recheck refuting a finding over bytes unchanged since its consult records it rejected, and after a change accepted", async () => {
  const room = checkout();
  const root = repoRoot(room);
  const sentAs = (text) => [{ rel: "judged.txt", sha: digest(text), chars: text.length, clipped: false }];
  const same = seeded([consultRow(root, { id: "c1", files: ["judged.txt"], sent: sentAs("reviewed, and fixed\n"), reply: FINDING })]);
  const unmoved = await forge(room, same, ["consult", "--recheck", "--of", "c1", "--rounds", "1"]);
  assert.equal(unmoved.status, 0, unmoved.said);
  assert.match(unmoved.said, /accepted: none; rejected: F1, refuted over files unchanged since c1\./u);
  const never = rowsOf(same).find((one) => one.kind === "verdict");
  assert.deepEqual([never.kept, Object.keys(never.dropped)], [[], ["F1"]], "nothing moved, so nothing was fixed: the finding was never real");
  const moved = seeded([consultRow(root, { id: "c1", files: ["judged.txt"], sent: sentAs("reviewed\n"), reply: FINDING })]);
  const fixed = await forge(room, moved, ["consult", "--recheck", "--of", "c1", "--rounds", "1"]);
  assert.equal(fixed.status, 0, fixed.said);
  assert.deepEqual(rowsOf(moved).find((one) => one.kind === "verdict").kept, ["F1"], "the file changed since, so the refutation is a fix");
});

/* The ISS-513 sequence: a recheck over one file ruled nothing it could stand behind and left F1 open,
   and the next recheck, given no --of, was refused as though that recheck were a whole-set read (ISS-2643). */
test("a recheck given no --of after a recheck that left a finding open answers the consult that made it", async () => {
  const room = checkout();
  const root = repoRoot(room);
  const origin = consultRow(root, { id: "c1", files: ["judged.txt", "other.txt"], reply: FINDING });
  const first = consultRow(root, { id: "r1", recheck: true, files: ["judged.txt"],
    sent: [{ rel: "judged.txt", chars: 20, clipped: false }], reply: "1. CANNOT TELL — the wording is on the tracker.\n\nCODEX: 0 findings" });
  const open = { kind: "verdict", of: "c1", from: "r1", kept: [], dropped: {}, reopened: ["F1"], auto: ["F1"] };
  const home = seeded([origin, first, open]);
  const { status, said, shown } = await forge(room, home, ["consult", "--recheck", "--rounds", "1", "judged.txt"]);
  assert.equal(status, 0, said);
  assert.match(said, /recheck r1 left F1 of consult c1 open, so this recheck answers c1/u);
  assert.match(shown, /Your earlier finding F1 still stands/u, "c1's finding went to the reviewer");
  const rows = rowsOf(home);
  const served = rows.filter((one) => one.kind === "consult" && one.recheck).at(-1);
  assert.equal(served.rechecked, "c1", "the recheck's row names the consult it answered");
  const read = rows.filter((one) => one.kind === "verdict" && one.of === "c1").at(-1);
  assert.deepEqual([read.from, read.kept, read.reopened], [served.id, ["F1"], undefined], "and its verdict on c1 is the one read now");

  const settled = seeded([origin, first, { ...open, kept: ["F1"], reopened: undefined }]);
  const refused = await forge(room, settled, ["consult", "--recheck", "--rounds", "1", "judged.txt"]);
  assert.notEqual(refused.status, 0);
  assert.match(refused.said, /consult r1 is a recheck of consult c1 and raised no finding of its own, and c1 has nothing left open/u);
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

test("consult -h lists --of, and what a recheck given only keys sends", async () => {
  const room = checkout();
  const { said } = await forge(room, seeded([]), ["consult", "-h"]);
  assert.match(said, /^ {2}--of <id> {6}the answered consult a recheck pins by id, in any worktree of this repository;/mu);
  assert.match(said, /^ {17}with only ISS-nn named, the files the last consult naming them recorded travel$/mu);
});

/* The issue's own five steps: Phase 3 keeps the plan outside the checkout and consults it by the issue's
   key, and the recheck that proves a fix landed named the key alone and found nothing to answer. */
test("a recheck given only the issue key answers the plan's consult, sending the plan's body as it reads now", async () => {
  const room = checkout();
  const plan = join(tempRoom("codex-recheck-key-scratch-"), "plan.md");
  writeFileSync(plan, "# Plan\n\n1. Step one serves nothing.\n");
  const home = seeded([]);
  const raised = await forge(room, home, ["consult", "ISS-1", "--send", "bodies", plan, "--rounds", "1"],
    "CODEX: 1 findings\n- **F1 — New — major:** `plan.md:3` — step one names no criterion.");
  assert.equal(raised.status, 0, raised.said);
  const consulted = rowsOf(home).find((one) => one.kind === "consult");
  writeFileSync(plan, "# Plan\n\n1. Step one serves criterion 1.\n");
  const { status, said, shown } = await forge(room, home, ["consult", "ISS-1", "--recheck", "--rounds", "1"]);
  assert.equal(status, 0, said);
  assert.match(said, new RegExp(`a recheck of ${consulted.id}, the last consult here to name ISS-1, so the 1 file\\(s\\) it recorded travel\\.`, "u"));
  assert.ok(shown.includes("Step one serves criterion 1."), "the plan's body as it reads now reached the reviewer");
  assert.match(shown, /Your earlier finding F1 still stands/u, "and the finding anchored on its bare name went with it");
  const verdict = rowsOf(home).find((one) => one.kind === "verdict");
  assert.deepEqual([verdict?.of, verdict?.kept], [consulted.id, ["F1"]], "the ruling is recorded against the plan's consult");
});

test("a recheck given several keys answers the newest consult naming any of them", async () => {
  const room = checkout();
  const root = repoRoot(room);
  const on = (file) => `CODEX: 1 findings\n- **F1 — New — major:** \`${file}:1\` — the line is wrong.`;
  const home = seeded([
    consultRow(root, { id: "c1", issues: ["ISS-1"], files: ["other.txt"], reply: on("other.txt") }),
    consultRow(root, { id: "c2", at: "2026-09-26T11:00:00.000Z", issues: ["ISS-2"], files: ["judged.txt"], reply: FINDING }),
    consultRow(root, { id: "c3", at: "2026-09-26T12:00:00.000Z", issues: ["ISS-9"], files: ["other.txt"], reply: on("other.txt") }),
  ]);
  const { status, said } = await forge(room, home, ["consult", "ISS-1", "ISS-2", "--recheck", "--rounds", "1"]);
  assert.equal(status, 0, said);
  assert.match(said, /a recheck of c2, the last consult here to name ISS-1, ISS-2/u, "c3 is newer and names neither key");
  assert.deepEqual(recheckRow(home).files, ["judged.txt"]);
  assert.equal(rowsOf(home).find((one) => one.kind === "verdict")?.of, "c2");
});

test("a recheck given only keys is refused, with a route carrying a file, where no consult here answers for them", async () => {
  const room = checkout();
  const root = repoRoot(room);
  const home = seeded([consultRow(root, { id: "c1", files: ["judged.txt"], reply: FINDING }),
    consultRow(root, { id: "c2", issues: ["ISS-8"], files: [], reply: FINDING })]);
  const none = await forge(room, home, ["consult", "ISS-7", "--recheck", "--rounds", "1"]);
  assert.notEqual(none.status, 0);
  assert.match(none.said, /no answered consult in this checkout named ISS-7, so a recheck has no findings of theirs to answer/u);
  assert.match(none.said, /forge codex consult --recheck ISS-7 <file>\.\.\.`/u);
  const fileless = await forge(room, home, ["consult", "ISS-8", "--recheck", "--rounds", "1"]);
  assert.notEqual(fileless.status, 0);
  assert.match(fileless.said, /consult c2 recorded no file, so a recheck of it has no set of its own/u);
  assert.match(fileless.said, /forge codex consult ISS-8 <file>\.\.\.`/u);
  assert.equal(rowsOf(home).length, 2, "neither refusal logged a consult");
});

test("a recheck naming a file, --of or --diff beside a key selects as it did without the key", async () => {
  const room = checkout();
  const root = repoRoot(room);
  const rows = [consultRow(root, { id: "c0", files: ["judged.txt"], reply: FINDING }),
    consultRow(root, { id: "c1", at: "2026-09-26T11:00:00.000Z", issues: ["ISS-1"], files: ["other.txt"],
      reply: "CODEX: 1 findings\n- **F1 — New — major:** `other.txt:1` — the line is wrong." })];
  for (const argv of [["judged.txt"], ["--of", "c0"], ["--diff"]]) {
    const home = seeded(rows, { root, files: ["judged.txt"] });
    const { status, said } = await forge(room, home, ["consult", "ISS-1", "--recheck", "--rounds", "1", ...argv]);
    assert.equal(status, 0, `${argv.join(" ")}: ${said}`);
    assert.deepEqual(recheckRow(home).files, ["judged.txt"], `${argv.join(" ")} kept its own ground, not c1's set`);
  }
});
