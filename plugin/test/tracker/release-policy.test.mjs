/* Several readings of the release policy in ONE process, which is what its memo is shared across. The
   tracker says nobody deploys on their own; each checkout's own `release` key says otherwise or
   agrees, so every reading shows which checkout's switch it was answered from. Each case makes its
   readings in the order it judges and counts only the tracker reads it made itself, so it reads the
   same alone as after its siblings. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, projectRoom, tempRoom } from "../fixtures.mjs";

const PROJECTS = [
  { slug: "right-here", id: "1e1c1a1e-0000-4000-8000-000000000001" },
  { slug: "over-there", id: "1e1c1a1e-0000-4000-8000-000000000002" },
];

const state = {
  answer: {
    "forge_projects.list": () => ({ projects: PROJECTS }),
    forge_config: (args) => (args.action === "get"
      ? { config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } } }
      : undefined),
  },
};
const tracker = await fakeTracker(state);

const home = tracker.env.XDG_CONFIG_HOME;
const here = projectRoom(tempRoom("release-policy-here-"), home, { slug: "right-here", release: "auto" });
const there = projectRoom(tempRoom("release-policy-there-"), home, { slug: "over-there", release: "manual" });
const yonder = projectRoom(tempRoom("release-policy-yonder-"), home, { slug: "over-there", release: "auto" });
const checkout = (name, slug) => projectRoom(tempRoom(`release-policy-${name}-`), home, { slug, release: "auto" });

process.chdir(here);
for (const [name, value] of Object.entries(tracker.env)) process.env[name] = value;

const { releaseFrom, releasePolicy } = await import("../../src/tracker/project-config.mjs");
const { useProject } = await import("../../src/resolve/settings.mjs");

const configReads = () => (state.calls ?? [])
  .filter((one) => one.name === "forge_config" && one.args?.action === "get");

const aimAt = (slug, room) => useProject({ slug, from: `the project file under ${room}` });

/* The slug of every tracker read the reading makes, and nothing a sibling case made before it. */
const readsDuring = async (reading) => {
  const before = configReads().length;
  await reading();
  return configReads().slice(before).map((one) => one.slug);
};

test.after(() => tracker.close());

test("a reading aimed at a named checkout after one of the standing checkout gets the named checkout's switch", async () => {
  const standing = await releasePolicy();
  assert.equal(standing.autoProd, true, "the standing checkout's own key says production deploys on its own");
  aimAt("over-there", there);
  const aimed = await releasePolicy(there);
  assert.equal(aimed.autoProd, false, "the named checkout's key says a person releases it, and that is what answers");
  assert.equal(aimed.autoProdFrom, `the project file under ${there}`,
    "and the answer names the named checkout's file as where it came from");
});

test("two readings aimed at two named checkouts each get the switch of the checkout they name", async () => {
  aimAt("over-there", yonder);
  assert.equal((await releasePolicy(yonder)).autoProd, true);
  assert.equal((await releasePolicy(there)).autoProd, false);
  assert.equal((await releasePolicy(yonder)).autoProdFrom, `the project file under ${yonder}`);
});

test("a reading aimed at another project asks the tracker under that project's slug", async () => {
  const near = checkout("near", "right-here");
  const far = checkout("far", "over-there");
  const slugs = await readsDuring(async () => {
    aimAt("right-here", near);
    await releasePolicy(near);
    aimAt("over-there", far);
    await releasePolicy(far);
  });
  assert.deepEqual(slugs, ["right-here", "over-there"],
    "one read per project, each asked under the project its checkout belongs to");
});

test("a repeated reading of one checkout under one project asks the tracker once", async () => {
  const again = checkout("again", "over-there");
  aimAt("over-there", again);
  const first = await releasePolicy(again);
  let second;
  const slugs = await readsDuring(async () => {
    second = await releasePolicy(again);
  });
  assert.deepEqual(slugs, [], "the second reading goes back to the tracker for nothing");
  assert.equal(second, first, "and is the first reading's own answer");
});

test("releaseFrom handed no reading takes the switch as undeclared, not out of the process's own file", () => {
  const policy = releaseFrom({ baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } });
  assert.equal(policy.autoProd, false,
    "the standing checkout's key says auto, and it is not the reading this call was handed");
  assert.match(policy.autoProdFrom, /`release` key being unset/u);
});
