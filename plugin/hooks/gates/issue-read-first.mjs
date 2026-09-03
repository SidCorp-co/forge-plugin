// Why the write is where this gate sits, and not the reading: how/issue-read-first.md.

import { deny, done, how, shellText, starts } from "../_hook.mjs";
import { refusalFor, sessionKey } from "../../src/tracker/comments.mjs";
import { joined, writeTargets } from "../../src/tracker/issue-read.mjs";
import { documentIdOf } from "../../src/tracker/issues.mjs";
import { accountCredentials } from "../../src/resolve/settings.mjs";

const resolved = async (refs) => {
  const seen = new Map();
  for (const ref of refs) seen.set(await documentIdOf(ref), ref);
  return [...seen].map(([documentId, ref]) => ({ ref, documentId }));
};

// A tracker that will not answer prints its reason and exits: this gate is last on the line for it.
export const run = async (ev) => {
  const said = starts(shellText(joined(ev.tool_input?.command)));
  const refs = writeTargets({ name: ev.tool_name, input: ev.tool_input }, said);
  if (!refs.length) done();
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) done();
  const { refusal } = await refusalFor(await resolved(refs), sessionKey(ev));
  if (refusal) deny(refusal + how());
  done();
};
