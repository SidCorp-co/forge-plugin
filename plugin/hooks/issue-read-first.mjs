#!/usr/bin/env node
// Why the write is where this gate sits, and not the reading: docs/HOOKS.md.

import { deny, readEvent, transcript } from "./_hook.mjs";
import { unreadKeys, writesAnIssue } from "../src/issue-read.mjs";

const ev = readEvent();
const current = { name: ev.tool_name, input: ev.tool_input };
if (!writesAnIssue(current)) process.exit(0);

const records = transcript(ev.transcript_path ?? "");
if (!records) process.exit(0);

// Only the agent's own tool calls count. A hook's own refusal names the read it is asking for, and
// reading that back out of the transcript would let the second attempt satisfy itself.
const uses = [];
for (const record of records) {
  const content = record?.message?.content;
  if (!Array.isArray(content)) continue;
  for (const block of content) {
    if (block?.type === "tool_use") uses.push({ name: block.name, input: block.input });
  }
}

const unread = unreadKeys(uses, current);
if (unread.length === 0) process.exit(0);

const key = unread[0];
deny(
  `Hold — this writes to ${unread.join(", ")} and nothing in this session has read `
    + `${unread.length > 1 ? "their comments" : "its comments"}.\n\n`
    + "The comments are where the state is: an answer already given, a decision already taken, a "
    + "correction to the body. `forge issue --full` returns none of them, which is how this gets "
    + "missed — the read that looks complete omits the discussion.\n\n"
    + `Do this: forge call forge_comments '{"action":"list","filters":{"issue":"${key}"}}' — then `
    + "re-send. An empty list satisfies this; not having looked does not.",
);
