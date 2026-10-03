/* A project the tracker binds to no deployment, reached over the tracker route: what the issue met
   (ISS-2207). Every refusal there was a true sentence about the binding and read as a fact about the
   deployment, and `[]` read as an application gone. Spawned, because what is judged is what a
   developer reads on each stream and the exit it ends with. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../../../fixtures.mjs";
import { OWN } from "../../../fixtures/own-keys.mjs";

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

const UNBOUND = "project has no active Coolify integration";

const state = {
  answer: {
    forge_coolify: (args) => {
      if (args.action === "list") return { integrations: [] };
      if (args.action === "status") return { deliveries: [] };
      return { refused: UNBOUND };
    },
  },
};

const tracker = await fakeTracker(state);
after(() => tracker.close());

const home = tracker.env.XDG_CONFIG_HOME;
const room = projectRoom(tempRoom("coolify-unbound-cwd-"), home, { slug: OWN.slug });
const configAt = join(home, "forge", "config.json");

const chose = (mode) => {
  const held = JSON.parse(readFileSync(configAt, "utf8"));
  if (mode === null) delete held.coolifyRoute;
  else held.coolifyRoute = mode;
  writeFileSync(configAt, JSON.stringify(held));
};

const ran = (...argv) => ranAsync(FORGE, ["coolify", ...argv], tracker.env, room);

const DEFAULTED = /^ {2}route answering: tracker, this project's own binding on the tracker {2}← the plugin's default, this machine having chosen neither$/mu;
const SWITCH = /^ {2}the saved instance and its own commands: forge doctor --coolify-route instance$/mu;

/* Once, and last: a route line printed twice is two mechanisms attaching it, and one printed above
   the refusal's own words is not what a reader of the tail sees. */
const namesTheRoute = (said, what) => {
  assert.match(said, DEFAULTED, `${what} does not name the route answering and where it was chosen:\n${said}`);
  assert.match(said, SWITCH, `${what} does not name the command that changes the route:\n${said}`);
  assert.equal(said.split("\n").filter((line) => line.startsWith("  route answering: ")).length, 1,
    `${what} names the route answering more than once:\n${said}`);
  assert.match(said.trimEnd().split("\n").at(-1), SWITCH, `${what} does not end with the route lines:\n${said}`);
};

test("a tracker refusal of a served subcommand ends naming the route answering and the switch", async () => {
  chose(null);
  for (const argv of [["targets"], ["rollback-images"], ["deploy", "--yes"], ["cancel", "--yes"]]) {
    const run = await ran(...argv);
    assert.equal(run.status, 1, `${argv[0]}: ${run.stdout}`);
    assert.match(run.stderr, new RegExp(`^BAD_REQUEST: ${UNBOUND}$`, "mu"), "the tracker's own words still lead");
    namesTheRoute(run.stderr, argv[0]);
  }
});

test("an empty listing keeps [] and exit 0, and names the route answering on stderr", async () => {
  chose(null);
  for (const name of ["list", "status"]) {
    const run = await ran(name, "--json");
    assert.equal(run.status, 0, `${name}: ${run.stderr}`);
    assert.deepEqual(JSON.parse(run.stdout), [], `${name}'s stdout is still the listing a script reads`);
    assert.match(run.stderr, new RegExp(`^coolify ${name}: the tracker route answered with nothing\\.$`, "mu"));
    namesTheRoute(run.stderr, name);
  }
});

test("a flag only the saved instance's deploy takes is refused naming the route answering", async () => {
  chose(null);
  const run = await ran("deploy", "--uuid", "x0kgks0kgc4", "--yes");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /No coolify deploy flag named --uuid/u);
  namesTheRoute(run.stderr, "deploy --uuid");
});

test("a name the tracker route does not serve is refused with the same route lines", async () => {
  chose(null);
  for (const name of ["app", "rollback", "applications"]) {
    const run = await ran(name, "list");
    assert.equal(run.status, 1, `${name}: ${run.stdout}`);
    namesTheRoute(run.stderr, name);
  }
});

/* The refusals no sibling's mechanism reached (ISS-3127): a word neither route has, a call naming
   nothing, and a built-in both routes answer, each refused while this route is the one answering. */
test("a mistyped name, a bare call and a built-in's refusal end with the same route lines", async () => {
  chose(null);
  for (const argv of [["targetz"], ["nonsense"], [], ["login"]]) {
    const run = await ran(...argv);
    const what = argv.join(" ") || "a bare call";
    assert.equal(run.status, 1, `${what}: ${run.stdout}`);
    namesTheRoute(run.stderr, what);
  }
  assert.match((await ran("targetz")).stderr, /^coolify: No command named targetz\. Did you mean: targets\?$/mu,
    "the refusal's own sentence still leads");
});

test("the saved instance's route refuses a mistyped name without the tracker route's lines", async () => {
  chose("instance");
  const run = await ran("nonsense");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^coolify: No group named nonsense\./mu, run.stderr);
  assert.doesNotMatch(run.stderr, /route answering:/u, `the instance route named the tracker route:\n${run.stderr}`);
});

test("a route this machine chose is named by the file it was read from", async () => {
  chose("tracker");
  const run = await ran("targets");
  assert.equal(run.status, 1, run.stdout);
  assert.ok(run.stderr.includes(`  route answering: tracker, this project's own binding on the tracker  ← ${configAt}`),
    `the route line names the file the choice was read from:\n${run.stderr}`);
});
