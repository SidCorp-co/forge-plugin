/* The tracker's own history of an issue's moves, read where the page cannot say where a park came
   from: a park whose move landed and whose record did not leaves nothing there naming it (ISS-425). */
import { scoped } from "../../tracker/rest.mjs";
import { refuse } from "../../refusal.mjs";
import { ORDER, PARK_STATUS, SIDE, parkRecord, parkThatSet, sameLanding, setForm } from "../earned.mjs";

const MOVED = "issue.statusChanged";
const PAGE = 100;
/* A bound on the walk, so a history the cursor cannot get past ends in a refusal rather than a loop. */
const PAGES = 20;

const firstLine = (text) => String(text ?? "").split("\n")[0];

/** Walked back through the history newest first from the move into `status`: when that move was, and
 *  the status the issue stood at before it entered side statuses at all — a park from one side status
 *  to another leaves where the first left — or `unread` saying why neither was found. */
const moveInto = async (documentId, status) => {
  let before = null;
  let at = null;
  for (let page = 0; page < PAGES; page += 1) {
    const held = await scoped("forge_issues",
      { action: "issue_activity", documentId, limit: PAGE, ...(before ? { before } : {}) }, true);
    if (held?.refused) return { unread: firstLine(held.refused) };
    const events = held?.events ?? [];
    for (const one of events.filter((event) => event.action === MOVED)) {
      if (at === null && !sameLanding(one.to, status)) return { unread: `its newest move is into ${one.to}` };
      at ??= one.at;
      if (!SIDE.includes(one.from)) return { from: one.from, at };
    }
    if (!events.length || !held.nextBefore) return { unread: `it holds no move into ${status}` };
    before = held.nextBefore;
  }
  return { unread: `no move into ${status} in its newest ${PAGE * PAGES} events` };
};

/** The status a park written now leaves, and when the issue entered the one it stands in: its own
 *  status where that is no side status, the park paired with its entry where one is, and otherwise
 *  the history's. Refused with nothing written where none of them names a step of the flow, since a
 *  record naming anything else resumes nowhere. */
export const parkLeft = async (view, ref) => {
  const status = view.issue.status;
  if (!SIDE.includes(status)) return { left: status, at: null };
  const paired = parkThatSet(view, status)?.record.fields.left;
  if (ORDER.includes(paired)) return { left: paired, at: null };
  const moved = await moveInto(view.documentId, status);
  if (ORDER.includes(moved.from)) return { left: moved.from, at: moved.at };
  return refuse(`${ref} is ${status}, and the park record would name the status it left, which the `
    + `page cannot say and the tracker's history ${moved.unread ? `would not: ${moved.unread}` : `names as \`${moved.from}\`, no step of the flow`}. `
    + `Nothing was written. Whoever knows where it belongs sets it, and this writes a status no entry `
    + `check read:\n  ${setForm(ref, "<status>")}`);
};

/** The half of a park that did not land, found by which write did: the issue already holds the side
 *  status the park lands in, and no park of that landing was written since the tracker moved it there. */
export const finishes = (view, status, since) => SIDE.includes(status) && sameLanding(view.issue.status, status)
  && !parkRecord(view, (one) => sameLanding(PARK_STATUS[one], status), since);
