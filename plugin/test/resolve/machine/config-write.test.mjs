/* A config write lands on the file as it stands at the write, never on what its own process read at
   the start. `forge doctor` reads early and records its capability probes after awaiting them, and
   merged onto that early read its write erased a coolify route another process chose meanwhile, and
   another project's capabilities with it (ISS-2207). The tracker here writes the file from inside
   the probe it answers, which is the window between that read and that write. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../../fixtures.mjs";
import { OWN } from "../../fixtures/own-keys.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const CONFIG = fileURLToPath(new URL("../../../src/resolve/config.mjs", import.meta.url));

const ELSEWHERE = { checkedAt: "2026-10-02T00:00:00.000Z", forge_knowledge: "not for this token" };

const state = { answer: {} };
const tracker = await fakeTracker(state);
after(() => tracker.close());

const home = tracker.env.XDG_CONFIG_HOME;
const room = projectRoom(tempRoom("config-write-cwd-"), home, { slug: OWN.slug });
const configAt = join(home, "forge", "config.json");
const held = () => JSON.parse(readFileSync(configAt, "utf8"));

/* What a second process does while the doctor waits on its probes: one write of its own, by hand,
   so nothing of the code under test makes it. */
const meanwhile = () => {
  const now = held();
  now.coolifyRoute = "instance";
  now.capabilities = { ...(now.capabilities ?? {}), "another-project": ELSEWHERE };
  writeFileSync(configAt, JSON.stringify(now));
};

test("a doctor recording its probes keeps a route and another project's entry written while they ran", async () => {
  const before = held();
  delete before.coolifyRoute;
  delete before.capabilities;
  writeFileSync(configAt, JSON.stringify(before));
  /* The first call alone: the guides are asked again once the probes are recorded, and a second
     write there would put back whatever the recording erased. */
  let probed = false;
  state.answer.forge_guide = () => {
    if (!probed) meanwhile();
    probed = true;
    return { guides: [] };
  };
  const run = await ranAsync(FORGE, ["doctor", "tracker"], tracker.env, room);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const after = held();
  assert.equal(after.coolifyRoute, "instance", "the route chosen while the probes ran is still the machine's");
  assert.deepEqual(after.capabilities["another-project"], ELSEWHERE, "and so is the other project's entry");
  assert.ok(after.capabilities[OWN.slug]?.checkedAt, "beside this project's own, which the doctor recorded");
});

test("two writes of one table's fields, each from a process that read before the other wrote, both land", async () => {
  writeFileSync(configAt, JSON.stringify({ ...held(), capabilities: {} }));
  const script = (slug) => `const config = await import(${JSON.stringify(CONFIG)});`
    + " config.userConfig(); await new Promise((done) => setTimeout(done, 300));"
    + ` config.saveNested("capabilities", { ${JSON.stringify(slug)}: { checkedAt: "now" } });`;
  const runs = await Promise.all(["one", "two"].map((slug) =>
    ranAsync(process.execPath, ["--input-type=module", "-e", script(slug)], tracker.env, room)));
  for (const run of runs) assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(Object.keys(held().capabilities).sort(), ["one", "two"]);
});
