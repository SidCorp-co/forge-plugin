/* Every refusal a writing verb ends on leads with `<call>: nothing written.` while nothing has landed
   (Agenfold's ISS-28: a note refused on a draft never said so). Which verbs write is read off the route
   table — a route a verb claims, or writes through, that the table marks `writes` — and this walks
   every verb, so one that writes and is not read as writing, or one read as writing whose refusal
   does not lead, goes red here. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../../fixtures.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

const { VERBS, writesVerb } = await import("../../../src/resolve/visibility.mjs");

const SRC = new URL("../../../src/", import.meta.url).pathname;
const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const NOT_A_FLAG = "--no-such-flag-anywhere";

const tracker = await fakeTracker({ answer: {} });
after(() => tracker.close());
const room = projectRoom(tempRoom("every-write-verb-"), tracker.env.XDG_CONFIG_HOME, { slug: OWN.slug });

const LEAD = /: nothing written\.$/u;

test("every verb the route table reads as writing leads its refusal with nothing written, and no other verb does", async () => {
  const writing = VERBS.map(([verb]) => verb).filter(writesVerb);
  assert.ok(writing.length > 10, `${writing.length} writing verb(s) read: ${writing.join(", ")}`);
  for (const verb of ["claim", "issue", "new", "attach", "record", "advance", "comment"]) {
    assert.ok(writing.includes(verb), `${verb} writes, and the table does not read it as writing`);
  }
  for (const [verb] of VERBS) {
    /* Shaped as a write on one issue, a key then a flag no verb takes, so the refusal is met before
       anything is sent and on the path a write takes rather than a listing's. */
    const run = await ranAsync(FORGE, [verb, "ISS-1", NOT_A_FLAG], tracker.env, room);
    const first = run.stderr.split("\n")[0];
    if (writesVerb(verb)) {
      assert.equal(run.status, 1, `${verb}: ${run.stdout}`);
      assert.match(first, new RegExp(`^${verb}\\b[^\\n]*: nothing written\\.$`, "u"), `${verb}:\n${run.stderr}`);
    } else {
      assert.doesNotMatch(first, LEAD, `${verb} writes nothing and its refusal says it wrote nothing:\n${run.stderr}`);
    }
  }
});

/* The other direction: a verb whose own module sends a tracker write is one the table must read as
   writing, or its refusals would go out with no lead. Read off the source, by the doors a write goes
   through, so a verb added tomorrow is held to it without being named here. */
const DOORS = /import\s*\{([^}]*)\}\s*from\s*"([^"]*(?:tracker\/rest|tracker\/field-write|tracker\/comments)\.mjs)"/gu;
const WRITES = /\b(?:write|writeField|postComment)\b/u;

test("a verb whose own module imports a tracker write is read as writing", () => {
  const table = readFileSync(resolve(SRC, "commands.mjs"), "utf8");
  const loaded = [...table.matchAll(/"?([a-z-]+)"?:\s*loads\("([^"]+)"/gu)].map(([, verb, path]) => [verb, resolve(SRC, path)]);
  assert.ok(loaded.length > 10, `${loaded.length} verb module(s) read off commands.mjs`);
  const importing = loaded.filter(([, file]) => [...readFileSync(file, "utf8").matchAll(DOORS)]
    .some(([, names, from]) => WRITES.test(names) && resolve(dirname(file), from).startsWith(SRC)));
  assert.ok(importing.length > 3, `${importing.map(([verb]) => verb).join(", ")}`);
  assert.deepEqual(importing.filter(([verb]) => !writesVerb(verb)).map(([verb]) => verb), [],
    "these verbs send a write and the route table does not read them as writing");
});
