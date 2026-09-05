/* The tracker the release step's filing reaches, apart because `spawnSync` blocks the caller's loop
   and a server the fixture held could not answer the child it started. */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker } from "../fixtures.mjs";

const [room, seed, calls, home] = process.argv.slice(2);
const at = (name) => join(room, name);
const recorded = { push: (one) => appendFileSync(at(calls), `${JSON.stringify(one)}\n`) };

const state = new Proxy({}, {
  get: (_, key) => (key === "calls" ? recorded
    : (existsSync(at(seed)) ? JSON.parse(readFileSync(at(seed), "utf8")) : {})[key]),
  set: () => true,
});

const tracker = await fakeTracker(state);
writeFileSync(at(home), tracker.env.XDG_CONFIG_HOME);
process.stdout.write("ready\n");
