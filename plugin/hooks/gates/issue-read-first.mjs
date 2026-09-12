// Three refusals, three pages: how/issue-read-first.md for where the write's reading sits,
// how/issue-shape.md for a filing read before it is made, how/wrapped-route.md for a verb's action.

import { resolve as resolvePath } from "node:path";

import { NOWHERE, deny, done, how, movedTo, shellText, startsAt } from "../_hook.mjs";
import { refusalFor } from "../../src/tracker/comments.mjs";
import { sessionKey } from "../../src/shown/ledger.mjs";
import { filingsOf, joined, toolOfCall, writeTargets } from "../../src/tracker/issue-read.mjs";
import { actionIn, wrappedRefusal } from "../../src/resolve/visibility.mjs";
import { refusalFrom, shapeOf } from "../../src/tracker/issue-shape.mjs";
import { documentIdOf } from "../../src/tracker/issues.mjs";
import { accountCredentials, projectAt, useProject } from "../../src/resolve/settings.mjs";

const SHAPE = "issue-shape";

/* One `git rev-parse` per distinct directory: the walk is a process and a gate has a deadline. */
const slugs = new Map();
const slugOf = (directory) => {
  if (!slugs.has(directory)) slugs.set(directory, projectAt(directory));
  return slugs.get(directory);
};

/** A key is unique inside a project, so it resolves in the one the command will act on. False where
 *  that directory names none, and a caller reading it says nothing at all (ISS-1190). */
const aimedAt = (directory) => {
  const slug = directory === null ? null : slugOf(directory);
  if (slug) useProject({ slug, from: `the directory the command runs in, ${directory}` });
  return Boolean(slug);
};

/* A move this reading cannot settle — `cd -`, a path from a variable — names no directory at all. */
const directoryOf = (text, at, here) => {
  const moved = movedTo(text, at);
  if (moved === null) return here;
  return moved === NOWHERE ? null : resolvePath(here, moved);
};

const resolved = async (refs) => {
  const seen = new Map();
  for (const ref of refs) seen.set(await documentIdOf(ref), ref);
  return [...seen].map(([documentId, ref]) => ({ ref, documentId }));
};

// A tracker that will not answer prints its reason and exits: this gate is last on the line for it.
export const run = async (ev) => {
  const text = shellText(joined(ev.tool_input?.command));
  const spoken = startsAt(text);
  const said = spoken.map((one) => one.said);
  const call = { name: ev.tool_name, input: ev.tool_input };
  const refs = writeTargets(call, said);
  const filings = filingsOf(call, said);
  const wrapped = wrappedRefusal(toolOfCall(call.name), actionIn(call.input));
  if (!refs.length && !filings.length && !wrapped) done();
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) done();
  const here = ev.cwd || process.cwd();
  // The shape first: a filing refused never happened, and its scope is the event's own directory.
  if (aimedAt(here)) {
    for (const filing of filings) {
      const refused = await refusalFrom(filing, shapeOf(filing));
      if (refused) deny(refused + how(SHAPE));
    }
  }
  if (wrapped) deny(wrapped + how("wrapped-route"));
  /* One group per command start: a compound may cross checkouts, and a tool call moves nowhere. */
  const groups = call.name === "Bash"
    ? spoken.map((one) => ({ at: directoryOf(text, one.at, here), refs: writeTargets(call, [one.said]) }))
    : [{ at: here, refs }];
  const targets = new Map();
  for (const group of groups) {
    if (!group.refs.length || !aimedAt(group.at)) continue;
    for (const one of await resolved(group.refs)) targets.set(one.documentId, one);
  }
  const { refusal } = await refusalFor([...targets.values()], sessionKey(ev));
  if (refusal) deny(refusal + how());
  done();
};
