/* The tracker the release step's filing reaches, apart because `spawnSync` blocks the caller's loop
   and a server the fixture held could not answer the child it started. */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker } from "../../../../plugin/test/fixtures.mjs";
import "./ends-with-spawner.mjs";

const [room, seed, calls, home] = process.argv.slice(2);
const at = (name) => join(room, name);
const recorded = { push: (one) => appendFileSync(at(calls), `${JSON.stringify(one)}\n`) };

const held = () => (existsSync(at(seed)) ? JSON.parse(readFileSync(at(seed), "utf8")) : {});

/* `racing` is another ship's rows, landing in the window between a lookup and the create after it;
   the create is stored beside them so a read after it finds both, `refusing` turns it back, and
   `cutAfterCreate` leaves every read after it short. */
const raced = (args) => {
  const seeded = held();
  const created = { documentId: seeded.mint ?? "filed-uuid", issueId: seeded.key, status: "open", ...args.data };
  const issues = [...(seeded.issues ?? []), ...seeded.racing, ...(seeded.refusing ? [] : [created])];
  const cut = seeded.cutAfterCreate ? { beyond: seeded.cutAfterCreate } : {};
  writeFileSync(at(seed), JSON.stringify({ ...seeded, racing: null, issues, ...cut }));
  return seeded.refusing ? { refused: seeded.refusing } : created;
};

/* The seed is the store: a writer that reads its own write back is refused by a tracker that only
   echoes. Reads stay the built-in's, apart from `beyond`, rows a route counts and will not serve. */
const answer = {
  forge_issues: (args) => {
    if (args.action === "list" && held().beyond) {
      const wanted = String(args.filters?.search ?? "").toLowerCase();
      const rows = (held().issues ?? [])
        .filter((one) => !wanted || JSON.stringify(one).toLowerCase().includes(wanted));
      return { issues: rows, returned: rows.length, hasMore: false, beyond: held().beyond };
    }
    if (args.action === "create" && held().racing) return raced(args);
    if (args.action !== "update" && args.action !== "transition") return undefined;
    const seeded = held();
    const rows = seeded.issues ?? [];
    const found = rows.findIndex((one) => one.documentId === (args.documentId ?? args.data?.issueId));
    if (found < 0) return undefined;
    rows[found] = { ...rows[found], ...(args.data ?? {}) };
    writeFileSync(at(seed), JSON.stringify({ ...seeded, issues: rows }));
    return rows[found];
  },
};

const state = new Proxy({}, {
  get: (_, key) => (key === "calls" ? recorded : (key === "answer" ? answer : held()[key])),
  set: () => true,
});

const tracker = await fakeTracker(state);
writeFileSync(at(home), tracker.env.XDG_CONFIG_HOME);
process.stdout.write("ready\n");
