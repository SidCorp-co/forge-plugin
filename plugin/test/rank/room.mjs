/* What a case of the rank stands in, and the shapes it builds a backlog out of. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;

/* A case about the weights stands outside this checkout: writing its own file would leave a run
   that died mid-case with a backlog ranked by a weight nobody set. */
const OWN = JSON.parse(readFileSync(`${ROOT}.forge.json`, "utf8"));
export const standing = (rank) => {
  const room = tempRoom("rank-project-");
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: OWN.slug, ...(rank ? { rank } : {}) }));
  return room;
};

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
