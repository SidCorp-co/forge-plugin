// Which transcript an event means, once for both sides of the hook boundary, since a check under
// src/ cannot import the harness. Memory is one project's, so memoryDir is never transcriptOf.
import { basename, dirname, join } from "node:path";

const SUBAGENTS = "subagents";

export const isSubagent = (ev) => ev.hook_event_name === "SubagentStop";
export const transcriptOf = (ev) => (isSubagent(ev) && ev.agent_transcript_path) || ev.transcript_path || "";

export const ownTranscript = (ev) => {
  const held = ev.transcript_path || "";
  if (!ev.agent_id || !held) return held;
  return join(held.replace(/\.jsonl$/u, ""), SUBAGENTS, `agent-${ev.agent_id}.jsonl`);
};

const projectDir = (path) => {
  const held = dirname(path);
  return basename(held) === SUBAGENTS ? dirname(dirname(held)) : held;
};

export const memoryDir = (ev) => {
  const held = ev.transcript_path || ev.agent_transcript_path || "";
  return held ? join(projectDir(held), "memory") : "";
};
