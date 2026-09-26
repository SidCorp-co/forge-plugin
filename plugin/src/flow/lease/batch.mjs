/* A batch on the record: the keys a tree's run id names, written onto each member's worklog by the
   claim its run takes in that tree, and read back with every sibling read live. Why the worklog and
   not an edge, and why only a capture clears it: docs/cli/the-work.md (ISS-64). */
import { runIdAt, runsFor } from "../../resolve/session/run-id.mjs";
import { shortSha } from "../../tracker/evidence.mjs";
import { FIELD } from "../lease.mjs";
import { readMember } from "../record/wave.mjs";
import { worklogOf } from "../worklog.mjs";

const JOIN = ", ";

const membersOf = (batch) => String(batch ?? "").split(",").map((one) => one.trim()).filter(Boolean);

/** Every key the tree's run id names, head first, where it names several and `key` among them; null otherwise. */
export const batchFor = (key, tree = process.cwd()) => {
  const keys = runsFor(runIdAt(tree)).map((one) => one.toUpperCase());
  return keys.length > 1 && keys.includes(String(key ?? "").toUpperCase()) ? keys.join(JOIN) : null;
};

/* A bare claim from another tree is a landing's or a judge's, which says nothing about where the
   member's work is, so it leaves the batch standing; a capture says exactly that, so it clears. */
export const batchPatch = (key, pushed, tree = process.cwd()) => {
  const batch = batchFor(key, tree);
  if (batch) return { batch };
  return pushed ? { batch: null } : {};
};

/** What a claim did to the batch, off the worklog before and after its write, or null where it did not move. */
export const batchSaid = (before, after, tree = process.cwd()) => {
  const was = before?.batch ?? null;
  const now = after?.batch ?? null;
  if (was === now) return null;
  if (now) return `batch: ${now}, read off the run id ${runIdAt(tree)} this tree was minted under, now on this member's worklog.`;
  return `batch: ${was} cleared, since this capture was taken in a tree whose run id does not name this member among several.`;
};

const sameSet = (one, two) => [...one].sort().join(JOIN) === [...two].sort().join(JOIN);

const siblingNow = async (key, members, read) => {
  const got = await read(key);
  if (got.refused) return { key, unreadable: String(got.refused).replace(/\s+/gu, " ").trim() };
  const work = worklogOf(got.body?.[FIELD]);
  const theirs = membersOf(work?.batch);
  return {
    key,
    status: String(got.body?.status ?? "unknown"),
    head: work?.head ?? null,
    batch: !theirs.length ? "none" : sameSet(theirs, members) ? "same" : "other",
  };
};

/** The batch a member's worklog names with each other member read now, one read per sibling and softly, or null where it names none. `read` is the tracker unless a caller hands another. */
export const batchLive = async (worklog, key, read = readMember) => {
  const members = membersOf(worklog?.batch);
  if (!members.length) return null;
  const own = String(key ?? "").toUpperCase();
  const siblings = [];
  for (const one of members.filter((two) => two !== own)) siblings.push(await siblingNow(one, members, read));
  return { members, siblings };
};

const THEIRS = { same: "", none: ", names no batch", other: ", names another batch" };

const siblingSaid = (one) => {
  if (one.unreadable) return `${one.key} unreadable: ${one.unreadable}`;
  return `${one.key} ${one.status}${one.head ? ` at ${shortSha(one.head)}` : ", no capture"}${THEIRS[one.batch]}`;
};

/** The one line both resume surfaces print, from what `batchLive` returned. */
export const batchLine = (live) => (live ? `batch       with ${live.siblings.map(siblingSaid).join("; ")}` : null);
