/* What a case of the rank stands in, and the shapes it builds a backlog out of. */

import { fakeTracker, projectEntry, projectRoom, ranAsync, tempRoom } from "../fixtures.mjs";
import { OWN } from "../fixtures/own-project.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;

/* A case about the weights stands outside this checkout: writing this checkout's own record would
   leave a run that died mid-case with a backlog ranked by a weight nobody set. The record goes under
   the configuration home the tracker fixture hands every child, which `rankRoom` sets below — so a
   room built before one exists is a case's mistake and is refused here rather than read as a project
   that declared nothing. */

let HOME = null;

const configured = (prefix, keys) => {
  if (!HOME) throw new Error("no configuration home yet: await rankRoom() before building a room");
  return projectRoom(tempRoom(prefix), HOME, { slug: OWN.slug, ...keys });
};

export const standing = (rank) => configured("rank-project-", rank ? { rank } : {});

export const declaring = (drain) => configured("rank-drain-", { drainedBy: drain });

/** Where this machine's record of a room built above sits, which is what a report of that room names
 *  as the source of a key it read. */
export const recordOf = (room) => projectEntry(room, HOME);

export const issue = (issueId, held = {}) => ({
  issueId,
  documentId: `u-${issueId}`,
  status: "open",
  priority: "medium",
  category: "feature",
  complexity: null,
  reopenCount: 0,
  mergedAt: null,
  createdAt: `2026-09-0${(Number(issueId.slice(4)) % 9) + 1}T00:00:00.000Z`,
  touched: Number(issueId.slice(4)),
  title: `${issueId} as it was filed`,
  description: "## Why\n\nSomething is wrong.\n\n## Outcome\n\nIt is right.\n\n## Out of scope\n\nNothing.\n",
  ...held,
});

/* prose-edges.mjs's convention: the marker makes a carrier, the phrase names the other end. */
export const claims = (phrase) => `It is blocked by the ${phrase} issue, and those edges are recorded.`;

/** One tracker and one plain directory for a file of cases. Every case stands in a directory it
 *  owns, never this checkout's own `rank` block (ISS-395); the caller closes the tracker. */
export const rankRoom = async () => {
  const state = { issues: [], comments: {}, calls: [], answer: {}, memory: {} };
  const tracker = await fakeTracker(state);
  HOME = tracker.env.XDG_CONFIG_HOME;
  const plain = standing(null);
  return {
    state,
    close: () => tracker.close(),
    ran: (argv, cwd = plain) => ranAsync(FORGE, argv, tracker.env, cwd),
    load: (issues, memory = {}) => {
      state.issues = issues;
      state.memory = memory;
    },
  };
};
