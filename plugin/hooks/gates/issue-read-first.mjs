// Why the write is where this gate sits, and not the reading: how/issue-read-first.md. Why a filing
// is read before it is made, and what that refusal declines to judge: how/issue-shape.md.

import { deny, done, how, shellText, starts } from "../_hook.mjs";
import { refusalFor, sessionKey } from "../../src/tracker/comments.mjs";
import { filingsOf, joined, writeTargets } from "../../src/tracker/issue-read.mjs";
import { refusalFrom, shapeOf } from "../../src/tracker/issue-shape.mjs";
import { documentIdOf } from "../../src/tracker/issues.mjs";
import { accountCredentials } from "../../src/resolve/settings.mjs";

const SHAPE = "issue-shape";

const resolved = async (refs) => {
  const seen = new Map();
  for (const ref of refs) seen.set(await documentIdOf(ref), ref);
  return [...seen].map(([documentId, ref]) => ({ ref, documentId }));
};

// A tracker that will not answer prints its reason and exits: this gate is last on the line for it.
export const run = async (ev) => {
  const said = starts(shellText(joined(ev.tool_input?.command)));
  const call = { name: ev.tool_name, input: ev.tool_input };
  const refs = writeTargets(call, said);
  const filings = filingsOf(call, said);
  if (!refs.length && !filings.length) done();
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) done();
  // The shape first: a filing refused is a filing that never happened, and it owes no reading.
  for (const filing of filings) {
    const refused = await refusalFrom(filing, shapeOf(filing));
    if (refused) deny(refused + how(SHAPE));
  }
  const { refusal } = await refusalFor(await resolved(refs), sessionKey(ev));
  if (refusal) deny(refusal + how());
  done();
};
