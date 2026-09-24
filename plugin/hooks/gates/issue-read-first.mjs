// Three refusals, three pages: how/issue-read-first.md for where the write's reading sits,
// how/issue-shape.md for a filing read before it is made, how/wrapped-route.md for a verb's action.

import { resolve as resolvePath } from "node:path";

import { NOWHERE, deny, done, how, movedTo, shellText, startsAt } from "../_hook.mjs";
import { owedFor, refusalOf } from "../../src/tracker/comments.mjs";
import { sessionSourced } from "../../src/resolve/config.mjs";
import { liveAlias } from "../../src/flow/lease.mjs";
import { filingsOf, joined, ownChecked, toolOfCall, writeTargets } from "../../src/tracker/issue-read.mjs";
import { actionIn, wrappedRefusal } from "../../src/resolve/visibility.mjs";
import { refusalFrom, shapeOf } from "../../src/tracker/issue-shape.mjs";
import { documentIdIfAny } from "../../src/tracker/issues.mjs";
import { accountCredentials, fail, projectAt, useProject } from "../../src/resolve/settings.mjs";

const SHAPE = "issue-shape";

/* One `git rev-parse` per distinct directory: the walk is a process and a gate has a deadline. */
const slugs = new Map();
const slugOf = (directory) => {
  if (!slugs.has(directory)) slugs.set(directory, projectAt(directory));
  return slugs.get(directory);
};

/** A key is unique inside a project, so it resolves in the one the command will act on. The project
 *  it aimed at, null where that directory names none and a caller reading it says nothing at all
 *  (ISS-1190); the name is what a resolution is remembered under, since the setter is global. */
const aimedAt = (directory) => {
  const slug = directory === null ? null : slugOf(directory);
  if (slug) useProject({ slug, from: `the directory the command runs in, ${directory}` });
  return slug;
};

/* A move this reading cannot settle — `cd -`, a path from a variable — names no directory at all. */
const directoryOf = (text, at, here) => {
  const moved = movedTo(text, at);
  if (moved === null) return here;
  return moved === NOWHERE ? null : resolvePath(here, moved);
};

/* One walk per key per project however many command starts name it, and one group's keys walked
   together: `useProject` is global, so the project is half the key and two groups stay serial
   (ISS-1458). A refusal is taken in the order the refs came rather than the order the tracker
   answered in, so which of two unresolvable keys a command is refused for does not move — which is
   why the walk is soft: a hard one refuses from inside whichever answered first. */
const resolved = async (refs, slug, walked) => {
  if (!walked.has(slug)) walked.set(slug, new Map());
  const held = walked.get(slug);
  const keys = [...new Set(refs)];
  const fresh = keys.filter((ref) => !held.has(ref));
  const answers = await Promise.all(fresh.map((ref) => documentIdIfAny(ref, { soft: true })));
  fresh.forEach((ref, at) => held.set(ref, answers[at]));
  return keys.map((ref) => {
    const one = held.get(ref);
    return one.refused ? fail(one.refused) : { ref, documentId: one.id };
  });
};

// A tracker that will not answer is a `fail()`, which the harness turns into this gate standing down where the session reads it: `forge hooks --how stood-down`.
export const run = async (ev) => {
  const text = shellText(joined(ev.tool_input?.command));
  const spoken = startsAt(text);
  const said = spoken.map((one) => one.said);
  const call = { name: ev.tool_name, input: ev.tool_input };
  const refs = writeTargets(call, said);
  const filings = filingsOf(call);
  const wrapped = wrappedRefusal(toolOfCall(call.name), actionIn(call.input));
  if (!refs.length && !filings.length && !wrapped) done();
  const { url, token } = accountCredentials();
  const canAskTracker = Boolean(url.value && token.value);
  const here = ev.cwd || process.cwd();
  // The shape first: a filing refused never happened, and its scope is the event's own directory.
  if (canAskTracker && aimedAt(here)) {
    for (const filing of filings) {
      const refused = await refusalFrom(filing, shapeOf(filing));
      if (refused) deny(refused + how(SHAPE));
    }
  }
  if (wrapped) deny(wrapped + how("wrapped-route"));
  if (!canAskTracker) done();
  /* One group per command start: a compound may cross checkouts, and a tool call moves nowhere. */
  const groups = call.name === "Bash"
    ? spoken.map((one) => ({ at: directoryOf(text, one.at, here), refs: writeTargets(call, [one.said]) }))
    : [{ at: here, refs }];
  const targets = new Map();
  const walked = new Map();
  for (const group of groups) {
    const slug = group.refs.length ? aimedAt(group.at) : null;
    if (!slug) continue;
    for (const one of await resolved(group.refs, slug, walked)) targets.set(one.documentId, one);
  }
  const primary = sessionSourced(ev);
  const id = primary.id || "";
  /* Also checked, never credited: the target's own live, minted lease holder, the one caller any write that could land already has to be — a delivery this call causes is this call's own (ISS-1558). */
  const keysFor = async (target) => ({
    check: [id, primary.environment ? await liveAlias(target.documentId) : null],
    credit: id,
  });
  const looked = await owedFor([...targets.values()], keysFor);
  if (!looked.first.length && ownChecked(call, said)) done();
  const refusal = await refusalOf(looked, keysFor);
  if (refusal) deny(refusal + how());
  done();
};
