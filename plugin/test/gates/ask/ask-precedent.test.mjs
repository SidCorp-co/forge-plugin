/* After a question: the owner's answer joins the project's layer, the gate's own answer never does,
   and a project that has not opted in keeps nothing. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { callHook, projectRoom, tempRoom } from "../../fixtures.mjs";
import { logOutcome } from "../../../src/asks/decided.mjs";

const HOOK = new URL("../../../hooks/entries/ask/ask-precedent.mjs", import.meta.url).pathname;
const QUESTION = { question: "Where should the weekly report go?", header: "Delivery",
  options: [{ label: "A file (Recommended)" }, { label: "A page" }] };

const project = (keys) => {
  const config = tempRoom("ask-precedent-config-");
  const repo = realpathSync(tempRoom("ask-precedent-repo-"));
  projectRoom(repo, config, keys);
  const env = { ...process.env, XDG_CONFIG_HOME: config, HOME: tempRoom("ask-precedent-home-"), TMPDIR: tempRoom("ask-precedent-tmp-") };
  return { repo, env, room: join(config, "forge", "projects", repo.split("/").at(-1), "asks") };
};

const answered = (held, id, answer) => callHook(HOOK, {
  hook_event_name: "PostToolUse", session_id: "s-post", tool_use_id: id, cwd: held.repo, tool_name: "AskUserQuestion",
  tool_input: { questions: [QUESTION] },
  tool_response: { questions: [QUESTION], answers: { [QUESTION.question]: answer }, annotations: { [QUESTION.question]: { notes: "and quickly" } } },
}, held.env, held.repo);

const rows = (held) => (existsSync(join(held.room, "precedents.jsonl"))
  ? readFileSync(join(held.room, "precedents.jsonl"), "utf8").split("\n").filter(Boolean).map((one) => JSON.parse(one)) : []);

test("a question the owner answers joins the project's layer with the answer and their note", () => {
  const held = project({ asks: { mode: "decide" } });
  const run = answered(held, "toolu_owner", "A page");
  assert.equal(run.stdout, "", "it says nothing");
  const [row] = rows(held);
  assert.deepEqual([row.id, row.kind, row.answer, row.matched, row.notes], ["toolu_owner#0", "owner", "A page", false, "and quickly"]);
});

test("a question the ask gate answered itself joins no layer, while the owner's next answer does", () => {
  const held = project({ asks: { mode: "decide" } });
  assert.equal(logOutcome({ outcome: "decided", toolUseId: "toolu_self", questions: [{ question: QUESTION.question,
    option: "A file (Recommended)", reason: "the owner chose it before", reversal: "move it back", precedent: { id: "p1" } }] },
  held.room), true);
  answered(held, "toolu_self", "A file (Recommended)");
  answered(held, "toolu_owner", "A page");
  assert.deepEqual(rows(held).map((one) => one.id), ["toolu_owner#0"]);
});

test("a decision log that cannot be read keeps the answer out, since it cannot say whose it was", () => {
  const held = project({ asks: { mode: "decide" } });
  mkdirSync(held.room, { recursive: true });
  for (const log of ['{"outcome":"decided","toolUseId":"toolu_self"\n', '{"outcome":"decided"}\n', '"decided"\n']) {
    writeFileSync(join(held.room, "decided.jsonl"), log);
    answered(held, "toolu_self", "A file (Recommended)");
    assert.deepEqual(rows(held), [], `a log reading ${log.trim()} keeps it out`);
  }
});

test("a project that has not opted in keeps nothing", () => {
  for (const keys of [{}, { asks: { mode: "off" } }]) {
    const held = project(keys);
    answered(held, "toolu_owner", "A page");
    assert.equal(existsSync(held.room), false, JSON.stringify(keys));
  }
});
