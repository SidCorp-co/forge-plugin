/* The brief is a ceremony a project can decline: gated `yolo` on fast delivery, its agents act first
   and the record follows. Exercised against a tracker answering the two reads the gate makes. */
import assert from "node:assert/strict";
import test from "node:test";

import { answered, callHookAsync } from "../fixtures.mjs";
import { trackerFor } from "../fixtures/own-project.mjs";
import { HOOK, repository } from "./fixture.mjs";

const repo = repository();
const state = {};
const { tracker, env } = await trackerFor(state, [repo.main]);
test.after(() => tracker.close());

const answering = ({ profile, fast }) => {
  state.calls = [];
  state.answer = {
    forge_config: (args) => {
      if (args.action === "gates") return { profile, overrides: {}, gates: [] };
      if (args.action === "document") {
        return { declared: true, revision: 3, document: fast === undefined ? {} : { delivery: { fast } } };
      }
      return undefined;
    },
  };
};

const dispatch = async (prompt, role = "forge:runner") => {
  const run = await callHookAsync(HOOK, {
    session_id: "session-waived", cwd: repo.main, tool_name: "Agent",
    tool_input: { description: "run it", prompt, subagent_type: role },
  }, { ...env, CLAUDE_CODE_SESSION_ID: "session-waived" }, repo.main);
  const answer = answered(run)?.hookSpecificOutput ?? {};
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason ?? "",
    context: answer.additionalContext ?? "" };
};

test("a yolo project on fast delivery takes a typed dispatch, and says why no brief was asked", async () => {
  for (const fast of [undefined, true]) {
    answering({ profile: "yolo", fast });
    const said = await dispatch("ISS-7: fix the parser and land it.");
    assert.equal(said.allowed, true, `refused with fast=${fast}: ${said.reason}`);
    assert.match(said.context, /No brief asked: forge-plugin is gated `yolo` on fast delivery/u);
  }
});

test("the judging role is waived alike", async () => {
  answering({ profile: "yolo" });
  assert.equal((await dispatch("ISS-7: judge it on staging.", "forge:qa")).allowed, true);
});

test("yolo with fast delivery turned off still asks for the brief, naming why", async () => {
  answering({ profile: "yolo", fast: false });
  const said = await dispatch("ISS-7: fix the parser and land it.");
  assert.equal(said.allowed, false);
  assert.match(said.reason, /^Hold — run `forge brief ISS-7/u);
  assert.match(said.reason, /Not waived: forge-plugin is gated `yolo` with fast delivery off/u);
});

test("a standard or strict project still asks for the brief", async () => {
  for (const profile of ["standard", "strict"]) {
    answering({ profile });
    const said = await dispatch("ISS-7: fix the parser and land it.");
    assert.equal(said.allowed, false, profile);
    assert.match(said.reason, new RegExp(`Not waived: forge-plugin is gated \`${profile}\``, "u"));
  }
});

test("the profile is read from the tracker on each dispatch, never remembered", async () => {
  answering({ profile: "yolo" });
  assert.equal((await dispatch("ISS-7: one.")).allowed, true);
  answering({ profile: "standard" });
  assert.equal((await dispatch("ISS-7: two.")).allowed, false);
  assert.ok(state.calls.some((one) => one.name === "forge_config" && one.args.action === "gates"));
});
