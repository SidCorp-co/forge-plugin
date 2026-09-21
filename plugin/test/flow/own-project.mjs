/* What every case in this tree needs of the machine's configuration and no case here is about: the
   project a call resolves is a record beside the machine's own keys now, so a child spawned against
   the tracker fixture's home finds none unless one is written there. One place, because a file
   composing it again would be a second answer to where this tree's project comes from. */
import { readFileSync } from "node:fs";

import { fakeTracker, projectRecord } from "../fixtures.mjs";

/** This checkout's own project keys, as a case hands them to a room standing in for it. */
export const OWN = JSON.parse(readFileSync(new URL("../../../.forge.json", import.meta.url), "utf8"));

/** A tracker to answer the calls and the environment they are made in: one configuration home for
 *  both halves the child reads — the account's credentials the fixture wrote, and this checkout's
 *  record of its own project. `rooms` are the other checkouts a case stands a child in, each
 *  recorded under that same home as this project. */
export const trackerFor = async (state, rooms = []) => {
  const tracker = await fakeTracker(state);
  const home = tracker.env.XDG_CONFIG_HOME;
  for (const at of [new URL("../../../", import.meta.url).pathname, ...rooms]) {
    projectRecord(at, home, OWN);
  }
  return { tracker, env: { ...tracker.env, HOME: home } };
};
