/* A reading aimed at ANOTHER checkout. `forge stats` classifies the Phase 7 act of the project a
   named directory belongs to, redirecting the tracker half by slug. The switch is that checkout's own
   key (ISS-2190), so it has to travel with the aim or one project's release model is paired with
   another's switch. One case, one process: the policy is resolved once
   per run, as the redirect it follows is. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, projectRoom, tempRoom } from "../../fixtures.mjs";

const tracker = await fakeTracker({
  answer: {
    "forge_projects.list": () => ({ projects: [{ slug: "over-there", id: "1e1c1a1e-0000-4000-8000-000000000002" }] }),
    /* The tracker says a person releases this project by hand; the checkout being read says
       otherwise, and it is the checkout that decides now. */
    forge_config: () => ({ config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } } }),
  },
});

const home = tracker.env.XDG_CONFIG_HOME;
const here = projectRoom(tempRoom("stats-aimed-here-"), home, { slug: "right-here", release: "manual" });
const there = projectRoom(tempRoom("stats-aimed-there-"), home, { slug: "over-there", release: "auto" });

process.chdir(here);
process.env.FORGE_URL = tracker.env.FORGE_URL ?? process.env.FORGE_URL;
for (const [name, value] of Object.entries(tracker.env)) process.env[name] = value;

const { phase7For } = await import("../../../src/stats/corpus/release.mjs");

test("the release switch of an aimed reading is the aimed checkout's own, not the one the shell stands in", async () => {
  const act = await phase7For(there);
  tracker.close();
  assert.equal(act.key, "deploy",
    "the checkout being read releases on its own, so its Phase 7 act is a deploy nobody commands");
  assert.equal(act.deploy, true, "and the row that counts an uncommanded act is armed for it");
});
