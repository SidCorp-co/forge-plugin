/* What the daily page's two readers of the tracker's status history share: the walk back through a
   project's activity, the reads they make of it, and the conditions under which neither can read at
   all. Why a page of that activity is asked once however many readers walk it:
   docs/cli/stats-the-reading.md. */
import { everyIssue } from "../../../tracker/issues.mjs";
import { scoped } from "../../../tracker/rest.mjs";
import { accountCredentials, projectTarget } from "../../../resolve/settings.mjs";

const PAGE = 200;
export const MOVED = "issue.statusChanged";

export const NO_ENDPOINT = "no Forge endpoint is saved on this machine";
export const SATURATED = "more events share one timestamp than a page of the history carries, so the walk cannot get past them";

export const firstLine = (text) => String(text ?? "").split("\n")[0];

/** The events of one history inside `[from, to)`, newest first by the tracker's cursor. The cursor
 *  moves to a millisecond past the oldest event a page held and events are kept by id, so two sharing
 *  a timestamp across a page boundary are both kept. A page adding none is the end where it is short
 *  of `limit`, and where it is full a tie as long as a page, which no cursor on time can get past. */
export const walkBack = async (ask, from, to, limit = PAGE) => {
  const held = new Map();
  let before = to;
  for (;;) {
    const page = await ask(new Date(before).toISOString());
    if (page?.refused) return { unread: firstLine(page.refused) };
    const events = page?.events ?? [];
    let oldest = Infinity;
    let fresh = 0;
    for (const one of events) {
      const at = Date.parse(one.at);
      oldest = Math.min(oldest, at);
      if (at < from || at >= to || held.has(one.id)) continue;
      held.set(one.id, { ...one, at });
      fresh += 1;
    }
    if (!events.length || !page.nextBefore || oldest < from) return { events: [...held.values()] };
    if (!fresh) return events.length < limit ? { events: [...held.values()] } : { unread: SATURATED };
    before = oldest + 1;
  }
};

/* A project's activity page by the project a scoped call is aimed at and its cursor, holding the
   promise: the second reader walking the same day asks the same cursors and is answered from here. */
const pages = new Map();

const activityPage = (before) => {
  const key = JSON.stringify([projectTarget()?.value ?? "", before]);
  if (!pages.has(key)) pages.set(key, scoped("forge_issues", { action: "activity", limit: PAGE, before }, true));
  return pages.get(key);
};

/** The reads both readers make of the tracker, one object so a test hands both the same tracker. */
export const TRACKER = {
  limit: PAGE,
  activity: activityPage,
  history: (documentId, before) => scoped("forge_issues", { action: "issue_activity", documentId, limit: PAGE, before }, true),
  issues: () => everyIssue({}, { soft: true }),
};

/** Two repositories registered under one tracker project, read once: read twice, one event would
 *  count twice. A registration naming no project stands alone. */
export const oncePerSlug = (registered) => {
  const held = new Map();
  for (const one of registered) {
    const key = one.slug ?? `\0${one.name}`;
    const was = held.get(key);
    held.set(key, was ? { ...was, name: `${was.name} and ${one.name}` } : one);
  }
  return [...held.values()];
};

export const endpointHeld = () => Boolean(accountCredentials().url.value && accountCredentials().token.value);
