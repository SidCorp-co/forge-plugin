/* The guide-parts table `forge stats runs` prints beside the class table: which part a run read,
   how many runs read it, and how many read it more than once. Its own file because runs.test.mjs is
   at the line cap; the corpus here is its own and no fixture of that file is touched. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { GUIDE_INDEX, guidePartOf, slugFor } from "../../src/stats/transcripts.mjs";
import { tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const PROJECT = "/fixture/project";
const BASE = Date.parse("2026-09-01T00:00:00.000Z");
const at = (seconds) => new Date(BASE + seconds * 1000).toISOString();

const use = (id, seconds, command) => JSON.stringify({
  timestamp: at(seconds),
  message: { role: "assistant", content: [{ type: "tool_use", id, name: "Bash", input: { command } }] },
});
const result = (id, seconds, content) => JSON.stringify({
  timestamp: at(seconds),
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: false }] },
});
const bash = (id, start, command, body = "ok") => [use(id, start, command), result(id, start + 2, body)];
const marker = (key) => JSON.stringify({
  timestamp: at(0), type: "user", message: { role: "user", content: `Skill forge:issue-flow ${key}` },
});

/* Two runs, so the read-again column is told apart from extra reads: run A reads one part three
   times and run B once, and the row has to say 4 calls, 2 runs, 1 read again. */
const corpus = () => {
  const room = tempRoom("stats-guide-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "session-guide", "tasks");
  mkdirSync(tasks, { recursive: true });
  writeFileSync(join(tasks, "a0011.output"), [
    marker("ISS-97"),
    ...bash("g1", 10, "./plugin/bin/forge claim ISS-97", "claimed"),
    ...bash("g2", 20, "forge guide issue-flow triage", "the part"),
    ...bash("g3", 30, "cd /w && ./plugin/bin/forge guide contract developed", "the part"),
    ...bash("g4", 40, "forge guide issue-flow triage", "the part"),
    ...bash("g5", 50, "forge guide", "the index"),
    ...bash("g6", 60, "forge guide issue-flow triage", "the part"),
  ].join("\n"));
  writeFileSync(join(tasks, "a0012.output"), [
    marker("ISS-96"),
    ...bash("h1", 10, "./plugin/bin/forge claim ISS-96", "claimed"),
    ...bash("h2", 20, "forge guide issue-flow triage", "the part"),
    ...bash("h3", 30, "forge guide contract developed", "the part"),
  ].join("\n"));
  return room;
};

const ask = (room, ...argv) =>
  spawnSync(FORGE, ["stats", "runs", "--project", PROJECT, ...argv], {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: tempRoom("stats-guide-home-"), TMPDIR: room },
  });

test("a guide call's part is read by the same lead-in as its class, and a bare call is the index", () => {
  assert.equal(guidePartOf("forge guide issue-flow triage"), "issue-flow triage");
  assert.equal(guidePartOf("cd /w && ./plugin/bin/forge guide contract developed"), "contract developed");
  assert.equal(guidePartOf("forge guide contract in_progress"), "contract in_progress");
  assert.equal(guidePartOf("forge guide"), GUIDE_INDEX);
  assert.equal(guidePartOf("forge guide issue-flow --for ISS-45"), "issue-flow");
  assert.equal(guidePartOf("forge issue ISS-45"), null);
  assert.equal(guidePartOf('pgrep -f "forge guide"'), null);
});

test("guide parts are a table of their own — calls, runs, runs that read again — and the class table keeps one row", () => {
  const room = corpus();
  const said = ask(room);
  assert.equal(said.status, 0, said.stderr);
  const has = (line) => assert.ok(said.stdout.includes(line), `${line}\n--- printed ---\n${said.stdout}`);
  has("guide parts read                      calls  runs  read again");
  has(`${"issue-flow triage".padEnd(36)}      4     2           1`);
  has(`${"contract developed".padEnd(36)}      2     2           0`);
  has(`${"(index)".padEnd(36)}      1     1           0`);
  assert.doesNotMatch(said.stdout, /^forge guide (?:issue-flow|contract)/mu, "the class table carries no per-part row");
  const json = ask(room, "--json");
  assert.equal(json.status, 0, json.stderr);
  const held = JSON.parse(json.stdout);
  assert.deepEqual(held.guideParts, [
    ["issue-flow triage", { calls: 4, runs: 2, again: 1 }],
    ["contract developed", { calls: 2, runs: 2, again: 0 }],
    ["(index)", { calls: 1, runs: 1, again: 0 }],
  ]);
  assert.equal(held.byClass.find(([label]) => label === "forge guide")[1].calls, 7);
});
