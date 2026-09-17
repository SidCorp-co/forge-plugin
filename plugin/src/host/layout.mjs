/* The host's layout for what a run leaves on disk, stated once because two readers ask opposite questions of it: a hook composes the one path an event means, `forge stats runs` recognises every name of that shape in a directory.
   So `form` compiles each matcher out of the very parts its composer joins, and a rename of either moves both directions or neither (ISS-1678). */
import { basename, join } from "node:path";

const ESCAPED = /[.*+?^${}()|[\]\\]/gu;
const pattern = (part) => part.replace(ESCAPED, "\\$&");

export const form = (head, tail) => ({
  of: (id) => `${head}${id}${tail}`,
  shape: new RegExp(`^${pattern(head)}\\S*${pattern(tail)}$`, "u"),
});

const TRANSCRIPT = ".jsonl";

export const AGENT_FILE = form("agent-", TRANSCRIPT);
export const AGENTS_DIR = "subagents";

export const TASK_FILE = form("a", ".output");
export const TASKS_DIR = "tasks";

export const sessionRoom = (transcript) =>
  (transcript.endsWith(TRANSCRIPT) ? transcript.slice(0, -TRANSCRIPT.length) : transcript);

export const agentTranscript = (transcript, id) =>
  join(sessionRoom(transcript), AGENTS_DIR, AGENT_FILE.of(id));

export const isAgentsDir = (directory) => basename(directory) === AGENTS_DIR;
