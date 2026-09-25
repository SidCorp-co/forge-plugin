/* Which causes are one root cause, by the links the tracker already holds and no link of this
   file's making: two causes whose matched issues are one issue, are joined by a `relates` edge, or
   carry one gate-recurrence marker in their titles are one row. A cause is matched by the search
   `forge next` reads, over open and closed issues alike and at that search's floor; a match an
   earlier write made is carried rather than asked again — docs/cli/stats.md. */
import { FLOOR, neighboursOf } from "../../tracker/filing/neighbours.mjs";
import { PROJECT } from "../../tracker/filing/plugin-defect.mjs";
import { otherOf } from "../../tracker/edges/kinds.mjs";
import { everyIssue, shortOf } from "../../tracker/issues.mjs";
import { scoped } from "../../tracker/rest.mjs";
import { accountCredentials, refusing, useProject } from "../../resolve/settings.mjs";

/** How many causes one write asks the tracker to match, past the ones an earlier write matched. */
export const MATCHED = 30;

const SETTLED = new Set(["closed", "dropped"]);
const CLOSED = "closed";
const MARKER = /\[gate-recurrence(?:-group)? [0-9a-f]+\]/u;

export const BEYOND = `past the first ${MATCHED} causes by score this write matched`;
export const NONE_NEAR = `no issue reads like it at the search's floor of ${FLOOR}`;

const endpointHeld = () => Boolean(accountCredentials().url.value && accountCredentials().token.value);

const firstLineOf = (error) => String(error?.message ?? error).split("\n")[0];

/* The `relates` edges of one issue, by the key at the other end. */
const relatesOf = async (documentId) => {
  const body = await scoped("forge_issues", { action: "get", documentId, fields: ["relations"] }, true);
  if (body?.refused) throw new Error(String(body.refused));
  return (body?.relations?.relates ?? []).map(otherOf).filter(Boolean);
};

/** The plugin's issues, every status, as a matcher and a reader of one issue; or why the tracker
 *  could not be asked. The tracker's reads are the caller's to stand in for. */
export const trackerOf = async (registered, { read = everyIssue, near = neighboursOf, held = endpointHeld, edges = relatesOf } = {}) => {
  if (!registered.some((one) => one.slug === PROJECT)) {
    return { refused: `the plugin's backlog, ${PROJECT}, is not a project registered on this device` };
  }
  if (!held()) return { refused: "no Forge endpoint is saved on this machine" };
  try {
    return await refusing(async () => {
      useProject({ slug: PROJECT, from: "the plugin's own backlog" });
      const all = await read({}, { soft: true });
      if (all.refused) return { refused: String(all.refused).split("\n")[0] };
      /* A reading short of the whole cannot say a cause matches nothing in it. */
      const short = shortOf(all, "the plugin's issues");
      if (short) return { refused: short.split("\n")[0] };
      const rows = new Map(all.rows.map((one) => [one.issueId, one]));
      const live = all.rows.filter((one) => !SETTLED.has(one.status));
      const closed = all.rows.filter((one) => one.status === CLOSED);
      return {
        rows,
        match: async (text) => refusing(async () => {
          const found = await near({ seed: text, place: null }, live, closed);
          const scored = [...found.suggestions.filter((one) => one.score !== null && one.score >= FLOOR), ...found.closed]
            .sort((left, right) => right.score - left.score);
          if (!scored.length && found.notes.length) throw new Error(found.notes[0]);
          return scored[0]?.issueId ?? null;
        }),
        issue: async (key) => {
          const row = rows.get(key);
          if (!row) return { key, unread: `${key} is not among the plugin's issues` };
          try {
            return { key, title: row.title, status: row.status, relates: await refusing(() => edges(row.documentId)) };
          } catch (error) {
            return { key, title: row.title, status: row.status, relates: [], unread: firstLineOf(error) };
          }
        },
      };
    });
  } catch (error) {
    return { refused: firstLineOf(error) };
  }
};

const markerOf = (title) => MARKER.exec(String(title ?? ""))?.[0] ?? null;

/* A union-find over cause keys: `join` makes two one, `root` names the one they became. */
const unions = (keys) => {
  const parent = new Map(keys.map((key) => [key, key]));
  const root = (key) => {
    let at = key;
    while (parent.get(at) !== at) at = parent.get(at);
    return at;
  };
  return { root, join: (left, right) => parent.set(root(left), root(right)) };
};

/** The matches this write holds: every cause an earlier write matched keeps its issues, and the
 *  first `MATCHED` of the rest by score are asked. Each unmatched cause carries why. */
export const matchesOf = async (ranked, tracker, followed = {}) => {
  const matched = new Map();
  const why = new Map();
  for (const cause of ranked) if (followed[cause.key]?.length) matched.set(cause.key, followed[cause.key]);
  const asked = ranked.filter((one) => !matched.has(one.key)).slice(0, MATCHED);
  for (const cause of asked) {
    if (!tracker.match) {
      why.set(cause.key, tracker.refused);
      continue;
    }
    try {
      const key = await tracker.match(`${cause.kind}: ${cause.met}`);
      if (key) matched.set(cause.key, [key]);
      else why.set(cause.key, NONE_NEAR);
    } catch (error) {
      why.set(cause.key, firstLineOf(error));
    }
  }
  for (const cause of ranked) if (!matched.has(cause.key) && !why.has(cause.key)) why.set(cause.key, BEYOND);
  return { matched, why, asked: asked.length };
};

/** The causes grouped into rows by the tracker's own links, each row with its issues read. */
export const familiesOf = async (causes, tracker, matches) => {
  const keys = [...new Set([...matches.matched.values()].flat())];
  const issues = new Map();
  for (const key of keys) {
    issues.set(key, tracker.issue ? await tracker.issue(key) : { key, unread: tracker.refused });
  }
  const { root, join } = unions(causes.map((one) => one.key));
  const byIssue = new Map();
  for (const [cause, named] of matches.matched) {
    for (const key of named) byIssue.set(key, [...(byIssue.get(key) ?? []), cause]);
  }
  const byMarker = new Map();
  for (const [key, one] of issues) {
    const marker = markerOf(one.title);
    if (marker) byMarker.set(marker, [...(byMarker.get(marker) ?? []), key]);
  }
  const joinIssues = (left, right) => {
    const [one, two] = [byIssue.get(left)?.[0], byIssue.get(right)?.[0]];
    if (one && two) join(one, two);
  };
  for (const same of byIssue.values()) for (const cause of same.slice(1)) join(same[0], cause);
  for (const [key, one] of issues) for (const other of one.relates ?? []) joinIssues(key, other);
  for (const same of byMarker.values()) for (const key of same.slice(1)) joinIssues(same[0], key);
  const rows = new Map();
  for (const cause of causes) {
    const at = root(cause.key);
    rows.set(at, [...(rows.get(at) ?? []), cause]);
  }
  /* An issue carrying the marker of a matched one is that cause's too, read off the walk already made. */
  const siblings = (named) => {
    const markers = new Set(named.map((key) => markerOf(issues.get(key)?.title)).filter(Boolean));
    return [...(tracker.rows?.values() ?? [])].filter((one) => markers.has(markerOf(one.title)) && !named.includes(one.issueId))
      .map((one) => ({ key: one.issueId, title: one.title, status: one.status, relates: [] }));
  };
  return [...rows.values()].map((joined) => {
    const named = [...new Set(joined.flatMap((one) => matches.matched.get(one.key) ?? []))];
    return {
      causes: joined,
      issues: [...named.map((key) => issues.get(key) ?? { key }), ...siblings(named)],
      unmatched: named.length ? null : matches.why.get(joined[0].key) ?? BEYOND,
    };
  });
};
