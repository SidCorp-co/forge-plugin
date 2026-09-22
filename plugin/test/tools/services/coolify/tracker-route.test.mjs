/* The route this verb takes by default, against a tracker this suite runs. Spawned, because what is
   judged is what a developer reads and which requests left at all: the whole point of the default is
   that a checkout holding no Coolify credential and no pin file still answers, and the whole point of
   a refusal here is that nothing was sent to the other route on the way to it. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../../../fixtures.mjs";
import { OWN } from "../../../fixtures/own-keys.mjs";
import { ROUTES } from "../../../../src/tracker/routes.mjs";
import { ROUTELESS, TRACKER_SERVED } from "../../../../src/tools/services/coolify/chosen-route.mjs";

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

const BINDING = {
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  stages: ["preview"],
  targets: [{ id: "bbbbbbbb-0000-4000-8000-000000000002", label: "Staging", resourceUuid: "x0kgks0kgc4" }],
  lastHealthStatus: "ok",
  breakerOpen: false,
};

/* One handler for every action, so a case reads back which one a subcommand asked for and with what. */
const state = {
  answer: {
    forge_coolify: (args) => {
      if (args.action === "list") return { integrations: [BINDING] };
      if (args.action === "targets") return { integrationId: args.integrationId, targets: [{ ...BINDING.targets[0], found: true }] };
      if (args.action === "status") return { deliveries: [{ integrationId: BINDING.id, status: "ok" }] };
      if (args.action === "rollback-images") return { current: "v2", images: [{ tag: "v2", isCurrent: true }] };
      if (args.action === "cancel") return { cancelled: true };
      return state.deploy ?? { dispatched: true, pendingHumanConfirm: false, integrationIds: [BINDING.id] };
    },
  },
};

const tracker = await fakeTracker(state);
after(() => tracker.close());

const home = tracker.env.XDG_CONFIG_HOME;

/* A checkout of its own holding this machine's record of its project, and neither a `coolify` key
   nor a `.coolify.json` anywhere above it: the state a checkout that never ran `coolify login` is
   in, and the state the default has to answer from. */
const bare = projectRoom(tempRoom("coolify-tracker-cwd-"), home, { slug: OWN.slug });

const saved = () => JSON.parse(readFileSync(join(home, "forge", "config.json"), "utf8"));

const chose = (mode) => {
  const path = join(home, "forge", "config.json");
  const held = saved();
  if (mode === null) delete held.coolifyRoute;
  else held.coolifyRoute = mode;
  writeFileSync(path, JSON.stringify(held));
};

const ran = async (...argv) => {
  state.calls = [];
  const answer = await ranAsync(FORGE, ["coolify", ...argv], tracker.env, bare);
  return { ...answer, calls: state.calls ?? [] };
};

test("with nothing saved and nothing pinned the verb answers over the tracker", async () => {
  chose(null);
  assert.equal(saved().coolify, undefined, "no instance is saved, so only the tracker route can answer");
  const run = await ran("list");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /Staging/u);
  assert.deepEqual(run.calls.map((one) => `${one.method} ${one.path.replace(/\/projects\/[^/]+\//u, "/projects/:id/")}`),
    ["GET /api/projects", "GET /api/projects/:id/integrations/coolify"],
    "the slug this CLI already holds turned into the identifier the path takes, then the binding route");
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, /\.coolify\.json|no project is pinned/u,
    "and nothing about a pin, which this route neither reads nor needs");
});

test("the verb is offered in the usage list with no instance saved", async () => {
  chose(null);
  const run = await ranAsync(FORGE, ["-h"], tracker.env, bare);
  assert.match(run.stdout, /^ {2}coolify\s+<login\|accounts\|list\|/mu,
    "and the row names the commands the route that answers takes, not the other route's");
});

test("the switch sends the verb to the instance and back, and a third value is refused", async () => {
  chose("instance");
  const away = await ran("list");
  assert.equal(away.status, 1);
  assert.match(away.stderr, /No Coolify instance is configured|No group named list/u);
  assert.deepEqual(away.calls, [], "nothing reached the tracker once the instance was chosen");
  chose("tracker");
  const back = await ran("list");
  assert.equal(back.status, 0, back.stderr);
  const bad = await ranAsync(FORGE, ["doctor", "--coolify-route", "sideways"], tracker.env, bare);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /No --coolify-route mode named sideways\. The set is tracker, instance\./u);
  assert.equal(saved().coolifyRoute, "tracker", "and the refused value did not replace the one held");
});

test("a name the tracker route does not serve is refused by name and reaches no instance", async () => {
  chose(null);
  for (const [name, said] of [
    ["applications", /has no route on this tracker's REST API/u],
    ["logs", /has no route on this tracker's REST API/u],
    ["runtime-logs", /has no route on this tracker's REST API/u],
    ["rollback", /the tracker serves `rollback` and this CLI does not offer it/u],
    ["whoami", /`whoami` is a command of the saved instance/u],
    ["app", /`app` is a command of the saved instance/u],
    ["deployment", /`deployment` is a command of the saved instance/u],
    ["project", /`project` is a command of the saved instance/u],
    ["resource", /`resource` is a command of the saved instance/u],
    ["ps", /`ps` is a command of the saved instance/u],
  ]) {
    const run = await ran(name);
    assert.equal(run.status, 1, `${name}: ${run.stdout}`);
    assert.match(run.stderr, said);
    assert.match(run.stderr, /forge doctor --coolify-route/u, `${name} does not say how to change the route`);
    assert.deepEqual(run.calls, [], `${name} sent a request before refusing`);
  }
});

test("the two commands about the saved credential answer on the tracker route too", async () => {
  chose(null);
  const run = await ran("accounts");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /No Coolify instance is configured|instance {2}/u);
  assert.deepEqual(run.calls, [], "and it reads files rather than asking the tracker");
});

test("a deploy the tracker held back is reported as a refusal, not as a deploy", async () => {
  chose(null);
  state.deploy = { dispatched: false, pendingHumanConfirm: true, integrationIds: [], reason: "prod-confirm" };
  const run = await ran("deploy", "--yes");
  state.deploy = null;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /nothing was dispatched/u);
  assert.match(run.stderr, /a production binding holds it until somebody confirms/u);
  assert.match(run.stderr, /confirm-prod-deploy/u, "and it names what would release it");
  assert.doesNotMatch(run.stdout, /dispatched/u, "nothing printed reads as a deploy that went");
});

test("a write is refused without --yes, and --dry-run prints the request without sending one", async () => {
  chose(null);
  const held = await ran("deploy");
  assert.equal(held.status, 1);
  assert.match(held.stderr, /a write is refused without --yes/u);
  assert.deepEqual(held.calls, []);
  const shown = await ran("cancel", "--deployment", "d-1", "--dry-run");
  assert.equal(shown.status, 0, shown.stderr);
  assert.match(shown.stdout, /POST \/api\/projects\/<projectId>\/integrations\/coolify\/cancel/u);
  assert.match(shown.stdout, /"deploymentUuid": "d-1"/u);
  assert.deepEqual(shown.calls, [], "a preview sends nothing");
});

/* The row reaches the tracker, and `forge doctor` is the one command whose whole point is every
   finding at once: a report that stops on its second row because a key another row of it is already
   about is missing has taken the diagnostic down with the fault it was meant to name. */
test("the report reaches its last row on a machine holding no tracker credential", async () => {
  const blank = tempRoom("coolify-no-credential-");
  mkdirSync(join(blank, "forge"));
  writeFileSync(join(blank, "forge", "config.json"), JSON.stringify({}));
  const room = projectRoom(tempRoom("coolify-no-credential-cwd-"), blank, { slug: OWN.slug });
  const run = await ranAsync(FORGE, ["doctor", "services"],
    { ...process.env, HOME: blank, XDG_CONFIG_HOME: blank }, room);
  assert.match(run.stdout, /coolify\s+the tracker's own bindings/u);
  assert.match(run.stdout, /their listing was not asked for/u,
    "the row says it did not ask rather than reading as a project bound to nothing");
  assert.match(run.stdout, /chatgpt framing|The rest of the reading/u,
    "and the rows after it printed, so nothing exited through the credential reader");
});

test("a subject that prints none of these rows makes no request for them", async () => {
  state.calls = [];
  const run = await ranAsync(FORGE, ["doctor", "machine"], tracker.env, bare);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual((state.calls ?? []).filter((one) => one.path.includes("/integrations/coolify")), [],
    "the binding listing was fetched for a subject that would not have shown it");
});

/* The contract, read off the declared rows alone. A fake accepting a request says nothing about
   whether the request was the one the tracker's own route takes, so the method, the suffix, where a
   selector rides and whether the row acts are asserted here rather than through a server. */
test("every served name has a row, and each row names its own method, suffix and selector", () => {
  const asked = { integrationId: "i-1", resourceUuid: "r-1", deploymentUuid: "d-1",
    issueId: "u-1", pipelineRunId: "p-1" };
  const made = (key) => ROUTES[key].requests(asked, "P").page;
  assert.deepEqual(Object.values(TRACKER_SERVED).filter((key) => !ROUTES[key]), [],
    "a name the verb serves with no row would refuse at the transport instead of answering");
  assert.deepEqual(made(TRACKER_SERVED.list), { method: "GET", path: "/projects/P/integrations/coolify" });
  assert.deepEqual(made(TRACKER_SERVED.targets),
    { method: "GET", path: "/projects/P/integrations/coolify/targets?integrationId=i-1" });
  assert.deepEqual(made(TRACKER_SERVED.status),
    { method: "GET", path: "/projects/P/integrations/coolify/status?integrationId=i-1" });
  assert.deepEqual(made(TRACKER_SERVED["rollback-images"]), { method: "GET",
    path: "/projects/P/integrations/coolify/rollback-images?integrationId=i-1&resourceUuid=r-1" });
  assert.deepEqual(made(TRACKER_SERVED.deploy), { path: "/projects/P/integrations/coolify/deploy",
    method: "POST", body: { issueId: "u-1", pipelineRunId: "p-1", integrationId: "i-1" } });
  assert.deepEqual(made(TRACKER_SERVED.cancel), { path: "/projects/P/integrations/coolify/cancel",
    method: "POST", body: { integrationId: "i-1", deploymentUuid: "d-1" } });
});

test("the two rows that act are declared writes, and the four that read are not", () => {
  assert.deepEqual(Object.entries(TRACKER_SERVED).filter(([, key]) => ROUTES[key].writes).map(([name]) => name),
    ["deploy", "cancel"],
    "a row that acts and does not say so is sent again by the retry ladder on a transient answer");
});

test("each name with no route is one the transport's own no-route table answers for", () => {
  for (const [name, key] of Object.entries(ROUTELESS)) {
    assert.equal(ROUTES[key], undefined, `${name} has a row, so it would be served rather than refused`);
  }
});
