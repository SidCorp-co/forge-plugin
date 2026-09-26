/* After a question: the owner's answer joins the project's layer, the gate's own answer never does,
   and a project that has not opted in keeps nothing. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { callHook, projectRoom, tempRoom } from "../fixtures.mjs";

const HOOK = new URL("../../hooks/entries/ask-precedent.mjs", import.meta.url).pathname;
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

test("a question the ask gate answered itself joins no layer", () => {
  const held = project({ asks: { mode: "decide" } });
  mkdirSync(held.room, { recursive: true });
  writeFileSync(join(held.room, "decided.jsonl"), `${JSON.stringify({ outcome: "decided", toolUseId: "toolu_self" })}\n`);
  answered(held, "toolu_self", "A file (Recommended)");
  assert.deepEqual(rows(held), []);
});

test("a project that has not opted in keeps nothing", () => {
  for (const keys of [{}, { asks: { mode: "off" } }]) {
    const held = project(keys);
    answered(held, "toolu_owner", "A page");
    assert.equal(existsSync(held.room), false, JSON.stringify(keys));
  }
});
