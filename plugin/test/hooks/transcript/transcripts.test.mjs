/* One home for which transcript an event means, read by a gate through the harness and by a check
   under src/ that cannot import it. What the cases are about is a delegated run, the one shape
   where the two readings disagree: its turn records are its own, its memory is its dispatcher's.
   The host keeps a session's transcript under the project's directory, an agent's two levels
   below that, and one memory directory per project — 632 agent transcripts and 20 memory
   directories on this machine, none of the latter under a session (ISS-587). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import * as harness from "../../../hooks/_hook.mjs";
import { isSubagent, memoryDir, ownTranscript, transcriptOf } from "../../../src/hooks/transcripts.mjs";

const PROJECT = "/home/someone/.claude/projects/-a-checkout";
const SESSION = `${PROJECT}/9a1.jsonl`;
const AGENT = `${PROJECT}/9a1/subagents/agent-b2c.jsonl`;
const GATES = new URL("../../../hooks/gates/", import.meta.url).pathname;

const filesUnder = (at) => readdirSync(at, { withFileTypes: true, recursive: true })
  .filter((one) => one.isFile() && one.name.endsWith(".mjs"))
  .map((one) => join(one.parentPath ?? one.path, one.name));

test("the harness re-exports the readings rather than spelling its own", () => {
  for (const [name, own] of [["isSubagent", isSubagent], ["transcriptOf", transcriptOf], ["ownTranscript", ownTranscript]]) {
    assert.equal(harness[name], own, `${name} through the harness is another function`);
  }
});

test("a gate reaches them through the harness and never the module itself", () => {
  const reaching = filesUnder(GATES).filter((one) => readFileSync(one, "utf8").includes("hooks/transcripts.mjs"));
  assert.deepEqual(reaching, [], "a gate importing the module directly splits the boundary again");
});

test("a subagent's stop is read on its own transcript and every other event on the one it names", () => {
  const stop = { hook_event_name: "SubagentStop", transcript_path: SESSION, agent_transcript_path: AGENT };
  assert.equal(isSubagent(stop), true);
  assert.equal(transcriptOf(stop), AGENT);
  assert.equal(transcriptOf({ hook_event_name: "PreToolUse", transcript_path: SESSION, agent_id: "b2c" }), SESSION);
});

test("a delegated run's own transcript is composed from the session it names and its id", () => {
  assert.equal(ownTranscript({ transcript_path: SESSION, agent_id: "b2c" }), AGENT);
  assert.equal(ownTranscript({ transcript_path: SESSION }), SESSION, "an event of no agent names its own");
  assert.equal(ownTranscript({ agent_id: "b2c" }), "", "and nothing is said where no transcript is");
});

test("memory is one project's, whichever of its transcripts the event names", () => {
  const memory = join(PROJECT, "memory");
  assert.equal(memoryDir({ transcript_path: SESSION }), memory);
  assert.equal(memoryDir({ hook_event_name: "SubagentStop", transcript_path: SESSION, agent_transcript_path: AGENT }), memory);
  assert.equal(memoryDir({ agent_transcript_path: AGENT }), memory, "an agent's alone climbs back out to it");
  assert.equal(memoryDir({}), "", "and an event naming no transcript names no directory");
});
