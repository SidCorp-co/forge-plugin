/* The guide-parts table `forge stats runs` prints beside the class table: which part a run read,
   how many runs read it, and how many read it more than once. Its own file because runs.test.mjs is
   at the line cap; the corpus here is its own and no fixture of that file is touched. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { GUIDE_INDEX, guidePartOf, slugFor } from "../../src/stats/transcripts.mjs";
import { METHOD } from "../../src/guides/version.mjs";
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
  spawnSync(FORGE, ["stats", "runs", "--checkout", PROJECT, ...argv], {
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
  /* The part is the guide call's, not the first call's: one pattern reads both, and a reading that
     filtered the first `forge` command would answer for the read a run did not make. */
  assert.equal(guidePartOf("forge issue ISS-45; forge guide contract developed"), "contract developed");
  assert.equal(guidePartOf("forge nosuchverb x && forge guide issue-flow"), "issue-flow");
});

test("guide parts are a table of their own — calls, runs, runs that read again — and the class table keeps one row", () => {
  const room = corpus();
  const said = ask(room);
  assert.equal(said.status, 0, said.stderr);
  const has = (line) => assert.ok(said.stdout.includes(line), `${line}\n--- printed ---\n${said.stdout}`);
  has("guide parts read                      calls  runs  read again");
  /* AC-19-8-12. A part out of a versioned copy carries the version that call was served, read off
     the line the part itself ends with; one from the plain root carries none, there being no version
     to name. The corpus above answers `the part` and no version line, so this row says so. */
  has(`${"issue-flow triage (version unread)".padEnd(36)}      4     2           1`);
  has(`${"contract developed".padEnd(36)}      2     2           0`);
  has(`${"(index)".padEnd(36)}      1     1           0`);
  assert.doesNotMatch(said.stdout, /^forge guide (?:issue-flow|contract)/mu, "the class table carries no per-part row");
  const json = ask(room, "--json");
  assert.equal(json.status, 0, json.stderr);
  const held = JSON.parse(json.stdout);
  assert.deepEqual(held.guideParts, [
    ["issue-flow triage (version unread)", { calls: 4, runs: 2, again: 1 }],
    ["contract developed", { calls: 2, runs: 2, again: 0 }],
    ["(index)", { calls: 1, runs: 1, again: 0 }],
  ]);
  assert.equal(held.byClass.find(([label]) => label === "forge guide")[1].calls, 7);
});

/* The reading has to be a fact about the run, and this copy's pin is not one: read off the pin, a
   transcript from before a project moved its `method` would be reported at the version nobody served
   it. So the row is off the answer the run was given, and the same transcript reads the same however
   this copy is configured — watched under two pins, because one pin proves nothing (ISS-673). */
test("the version is the one that call was served, so a reading does not move when this copy's pin does", () => {
  const room = tempRoom("stats-guide-served-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "session-served", "tasks");
  mkdirSync(tasks, { recursive: true });
  const ends = (version) => `## Phase 4\n\nThe part.\n\nMethod version ${version}, which this project runs; \`forge doctor\` names its source.`;
  writeFileSync(join(tasks, "a0021.output"), [
    marker("ISS-95"),
    ...bash("s1", 10, "./plugin/bin/forge claim ISS-95", "claimed"),
    ...bash("s2", 20, "forge guide issue-flow verification", ends(1)),
    ...bash("s3", 30, "forge guide issue-flow learning", ends(7)),
    ...bash("s4", 40, "forge guide contract developed", ends(1)),
  ].join("\n"));
  const parts = (pin) => {
    const home = tempRoom("stats-guide-pin-");
    mkdirSync(join(home, "forge"), { recursive: true });
    writeFileSync(join(home, "forge", "config.json"),
      JSON.stringify({ url: "https://nowhere.invalid/mcp", token: "a-throwaway-token" }));
    writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "served-fixture", method: pin }));
    const said = spawnSync(FORGE, ["stats", "runs", "--checkout", PROJECT, "--json"],
      { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: home, TMPDIR: room }, cwd: room });
    assert.equal(said.status, 0, said.stderr);
    return JSON.parse(said.stdout).guideParts;
  };
  const under = parts(METHOD);
  assert.deepEqual(under.find(([part]) => part.startsWith("issue-flow verification")),
    [`issue-flow verification (v${METHOD})`, { calls: 1, runs: 1, again: 0 }], JSON.stringify(under));
  assert.deepEqual(under.find(([part]) => part.startsWith("issue-flow learning")),
    ["issue-flow learning (v7)", { calls: 1, runs: 1, again: 0 }],
    "a version this copy does not ship is still the version that call was served");
  assert.ok(under.some(([part]) => part === "contract developed"),
    `a part from the plain root names no version: ${JSON.stringify(under)}`);
  /* The pin moved to a version this copy does not serve, which a served part would refuse — and
     the reading of a transcript taken before that is untouched by it, which is the whole point. */
  assert.deepEqual(parts(9), under, "the same transcript reads the same under a pin nobody served");
});
