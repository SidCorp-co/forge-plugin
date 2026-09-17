/* The layout is only stated once while nothing else states it, and a second copy reads exactly like
   a clean tree: the walk below is what fails the day one comes back (ISS-1678). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  AGENTS_DIR, AGENT_FILE, TASKS_DIR, TASK_FILE,
  agentTranscript, form, isAgentsDir, sessionRoom,
} from "../../src/host/layout.mjs";

const SRC = new URL("../../src", import.meta.url).pathname;

const sourcesUnder = (directory) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourcesUnder(path);
    return entry.name.endsWith(".mjs") ? [path] : [];
  });

test("the two directions of one name are compiled from one pair of parts", () => {
  const odd = form("run~", ".held");
  assert.ok(odd.shape.test(odd.of("77")), "what the composer writes, the matcher recognises");
  assert.ok(!odd.shape.test(AGENT_FILE.of("77")), "and it recognises no other form's name");
  assert.ok(!AGENT_FILE.shape.test(odd.of("77")), "in either direction");
});

test("a part carrying a regular expression's own punctuation matches as the text it is", () => {
  const dotted = form("a.", ".b");
  assert.ok(dotted.shape.test("a.x.b"));
  assert.ok(!dotted.shape.test("axx.b"), "the dot is a dot and not any character");
});

test("the names are the ones the host writes today", () => {
  assert.equal(AGENT_FILE.of("b2c"), "agent-b2c.jsonl");
  assert.ok(AGENT_FILE.shape.test("agent-b2c.jsonl"));
  assert.ok(!AGENT_FILE.shape.test("agent-b2c.jsonl.bak"));
  assert.equal(TASK_FILE.of("0001"), "a0001.output");
  assert.ok(TASK_FILE.shape.test("a0001.output"));
  assert.equal(AGENTS_DIR, "subagents");
  assert.equal(TASKS_DIR, "tasks");
});

test("a delegated run's transcript sits in the room named for the session's own", () => {
  assert.equal(sessionRoom("/p/-a-project/s.jsonl"), "/p/-a-project/s");
  assert.equal(sessionRoom("/p/-a-project/s"), "/p/-a-project/s", "a path with no suffix is its own room");
  assert.equal(agentTranscript("/p/-a-project/s.jsonl", "b2c"), "/p/-a-project/s/subagents/agent-b2c.jsonl");
  assert.ok(isAgentsDir("/p/-a-project/s/subagents"));
  assert.ok(!isAgentsDir("/p/-a-project/s"));
});

test("no second module under src spells a directory name this one holds", () => {
  const home = join(SRC, "host", "layout.mjs");
  for (const name of [AGENTS_DIR, TASKS_DIR]) {
    const spelt = sourcesUnder(SRC).filter((path) => readFileSync(path, "utf8").includes(`"${name}"`));
    assert.deepEqual(spelt, [home], `"${name}" is stated in ${spelt.length} module(s), and one holds it`);
  }
});
