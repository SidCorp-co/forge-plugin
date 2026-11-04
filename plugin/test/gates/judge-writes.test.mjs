/* The gate is a decision, so it is fired the way Claude Code fires a subagent's: the event names the
   dispatcher in `session_id` and the run in `agent_id`, the brief sits at the head of the run's own
   transcript, and the permission decision comes back on stdout. The briefs are built from the real
   emitters in brief/judge.mjs, so a marker renamed there fails here rather than passing a stale copy. */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { judgeText, requirementText } from "../../src/brief/judge.mjs";
import { agentTranscript } from "../../src/host/layout.mjs";
import { assertRouteFirst } from "../fixtures/route-first.mjs";
import { callHook, tempRoom } from "../fixtures.mjs";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HOOK = join(PLUGIN, "hooks", "entries", "judge-writes.mjs");

const JUDGE = judgeText("ISS-45", { urls: ["https://x.example"], program: null, tree: null, criteria: ["1", "2"], identity: null });
const REQUIREMENT = requirementText({ requirement: "REQ-79", clauses: ["BC-6"], urls: ["https://x.example"], identity: null });
const BUILDER = "Take ISS-45 from its title to landed code. Plan it, implement, prove by running, and ship it.";

const state = tempRoom("judge-writes-state-");
const ENV = { ...process.env, XDG_CONFIG_HOME: join(state, "config"), TMPDIR: join(state, "tmp") };
mkdirSync(ENV.TMPDIR, { recursive: true });

/* A subagent transcript whose first record is `brief`, under the session room the event names. */
const transcriptWith = (brief, agent) => {
  const room = tempRoom("judge-writes-");
  const session = join(room, "sess.jsonl");
  writeFileSync(session, `${JSON.stringify({ type: "user", promptSource: "typed" })}\n`);
  const own = agentTranscript(session, agent);
  mkdirSync(dirname(own), { recursive: true });
  writeFileSync(own, `${JSON.stringify({ type: "user", message: { content: brief } })}\n`);
  return session;
};

/* `brief` null is the master's own call, which carries no `agent_id`; any other is a subagent whose
   first prompt is that brief. A fresh agent id each time, so the per-run memo never carries over. */
const ask = (command, { brief = JUDGE, agent = randomUUID() } = {}) => {
  const event = { tool_name: "Bash", tool_input: { command }, session_id: "the-wave" };
  if (brief !== null) {
    event.agent_id = agent;
    event.transcript_path = transcriptWith(brief, agent);
  }
  const run = callHook(HOOK, event, ENV);
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason ?? "" };
};

const REFUSED = [
  ["forge doctor --set translate=vi", "config", /local configuration/u],
  ["forge-runner api requirements -X POST -d '{}'", "api", /raw tracker or configuration write/u],
  ["forge record plan ISS-45 --section x", "record", /record other than a verdict/u],
  ["forge advance ISS-45 --set open --why x", "advance", /moves the issue's status/u],
  ["forge new 'a probe issue'", "new", /creates a tracker record/u],
  ["forge claim ISS-45", "claim", /claims a lease/u],
];

for (const [command, label, cause] of REFUSED) {
  test(`a qa judge is refused ${label}: ${command}`, () => {
    const { allowed, reason } = ask(command);
    assert.equal(allowed, false, `${command} was allowed`);
    assertRouteFirst(reason, command);
    assert.match(reason, cause, "the refusal names which rule the command breaks");
    assert.match(reason, /forge record verdict/u, "and that a verdict is what a judge does write");
    assert.match(reason, /forge hooks --how judge-writes/u, "and the command that clears it");
  });
}

const ALLOWED = [
  "forge record verdict ISS-45 --criterion 1 --verdict pass --why done",
  "forge comment ISS-45 'judged: all criteria pass'",
  "forge issue ISS-45",
  "forge advance ISS-45 --owed",
  "forge doctor --credentials",
  "forge doctor project",
  "forge guide issue-flow verification",
  "forge-runner api issues/ISS-45",
  "forge-runner api projects/932d2e55/requirements/REQ-79/verdicts -X POST -d '{\"criterion\":\"BC-6\",\"verdict\":\"pass\"}'",
  "FORGE_SESSION_ID=the-run forge record verdict ISS-45 --criterion 2 --verdict pass --why ok",
  "grep -rn probe plugin/src",
];

for (const command of ALLOWED) {
  test(`a qa judge is allowed: ${command}`, () => {
    assert.equal(ask(command).allowed, true, `${command} was refused`);
  });
}

test("a requirement judge's brief is a judge session too, and its writes are refused", () => {
  const { allowed, reason } = ask("forge record plan REQ-79 --section x", { brief: REQUIREMENT });
  assert.equal(allowed, false);
  assert.match(reason, /record other than a verdict/u);
});

test("the master's own session is not a judge, so every one of these is allowed", () => {
  for (const [command] of REFUSED) {
    assert.equal(ask(command, { brief: null }).allowed, true, `${command} was refused in the master's session`);
  }
});

test("a builder run is not a judge, so none of these is refused in it", () => {
  for (const [command] of REFUSED) {
    assert.equal(ask(command, { brief: BUILDER }).allowed, true, `${command} was refused in a builder run`);
  }
});

test("a refused write in one invocation of a command refuses the whole", () => {
  assert.equal(ask("forge record plan ISS-45 --section x && echo done").allowed, false, "a compound write passes");
  assert.equal(ask("bash -c 'forge new a-probe'").allowed, false, "a -c body's write passes");
});

test("the name of a write in a quoted argument is data, not a command", () => {
  assert.equal(ask("echo 'forge record plan ISS-45'").allowed, true, "a quoted write is read as a command");
});
