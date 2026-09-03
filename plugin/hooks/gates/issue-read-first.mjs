// Why the write is where this gate sits, and not the reading: how/issue-read-first.md.

import { deny, shellText, starts, transcript, how, done } from "../_hook.mjs";
import { unreadKeys, writesAnIssue } from "../../src/tracker/issue-read.mjs";

export const run = (ev) => {
  const current = { name: ev.tool_name, input: ev.tool_input };
  // Which text answers which question: where a command starts for the write, the raw input for keys.
  if (!writesAnIssue(current, starts(shellText(ev.tool_input?.command)))) done();

  const records = transcript(ev.transcript_path ?? "");
  if (!records) done();

  // Only the agent's own tool calls: a refusal names the read it asks for, and would satisfy the next.
  const uses = [];
  for (const record of records) {
    const content = record?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type === "tool_use") uses.push({ name: block.name, input: block.input });
    }
  }

  const unread = unreadKeys(uses, current, (input) => starts(shellText(input?.command)));
  if (unread.length === 0) done();

  const key = unread[0];
  deny(
    `Hold — this writes to ${unread.join(", ")} and nothing in this session has read `
      + `${unread.length > 1 ? "their comments" : "its comments"}, which \`forge issue --full\` does `
      + "not return.\n\n"
      + `Do this: forge call forge_comments '{"action":"list","filters":{"issue":"${key}"}}' — then `
      + "re-send. An empty list satisfies this."
      + how(),
  );
};
