/* A project's dispatcher sessions and the tracker pages they wrote to, small enough to add up by hand. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ranAsync } from "../fixtures.mjs";
import { trackerFor } from "../fixtures/own-project.mjs";
import { render } from "../../src/flow/record/page.mjs";
import { slugFor } from "../../src/stats/corpus/corpus.mjs";

export const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
export const PROJECT = "/fixture/waves";
export const BASE = Date.parse("2026-09-20T00:00:00.000Z");
export const at = (minutes, seconds = 0) => new Date(BASE + minutes * 60_000 + seconds * 1000).toISOString();

/* The comment lands a moment after the call that wrote it, as the tracker stamps it. */
export const posted = (minute, kind, fields) => ({
  documentId: `c-${minute}`, createdAt: at(minute, 2), authorDeviceId: "d", body: render(kind, fields),
});
export const dispatch = (minute, member, session) => posted(minute, "wave", { member, role: "forge:runner", session });
export const fold = (minute, summary) => posted(minute, "fold", { summary });

export const took = (minute, landing) => ({ holder: "run", at: at(minute), how: "claim", status: "in_progress", landing });

export const row = (n, status, extra = {}) => ({
  documentId: `uuid-${n}`, issueId: `ISS-${n}`, title: `issue ${n}`, status,
  createdAt: `2026-09-01T00:${String(n).padStart(2, "0")}:00.000Z`, ...extra,
});

/* The calls as the host writes them: a tool use, and its result a second later unless refused. */
export const REFUSED_BODY = "Hold — ISS-99 owes a release note.";
export const call = (id, minute, command, { body = "done", error = false } = {}) => [
  JSON.stringify({ timestamp: at(minute), message: { role: "assistant", content: [{ type: "tool_use", id, name: "Bash", input: { command } }] } }),
  JSON.stringify({ timestamp: at(minute, 1), message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: body, is_error: error }] } }),
];
export const session = (calls) => calls.flatMap((one, index) => call(`t${index}`, ...one)).join("\n");

export const home = (sessions, subagent = null) => (env) => {
  const where = join(env.HOME, ".claude", "projects", slugFor(PROJECT));
  mkdirSync(where, { recursive: true });
  for (const [name, calls] of Object.entries(sessions)) writeFileSync(join(where, `${name}.jsonl`), `${session(calls)}\n`);
  if (subagent) {
    const under = join(where, "dispatcher-one", "subagents");
    mkdirSync(under, { recursive: true });
    writeFileSync(join(under, "agent-x.jsonl"), `${session(subagent)}\n`);
  }
};

export const readsOf = (project, name, action, documentId) => project.calls.filter((one) => one.name === name
  && one.args?.action === action && (one.args?.documentId === documentId || one.args?.filters?.issue === documentId));

export const standing = async (issues, comments, sessions, subagent = null, unasked = undefined) => {
  const project = { calls: [], config: { baseBranch: "master" }, issues, comments, unasked, answer: {
    forge_issues: (args) => (args.action === "get" && args.documentId === "uuid-4" ? { refused: "not this project's" } : undefined),
    forge_comments: (args) => {
      if (args.action !== "list") return undefined;
      const held = comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  } };
  const { tracker, env } = await trackerFor(project);
  home(sessions, subagent)(env);
  return { project, tracker, env, forge: (...argv) => ranAsync(FORGE, argv, env) };
};

