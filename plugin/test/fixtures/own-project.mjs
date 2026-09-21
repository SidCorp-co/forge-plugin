/* What every case in this tree needs of the machine's configuration and no case here is about: the
   project a call resolves is a record beside the machine's own keys now, so a child spawned against
   the tracker fixture's home finds none unless one is written there.

   The keys themselves are `./own-keys.mjs`, which imports nothing and says why. */
import { fakeTracker, projectRecord } from "../fixtures.mjs";

export { OWN } from "./own-keys.mjs";
import { OWN } from "./own-keys.mjs";

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
