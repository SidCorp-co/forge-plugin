/* The guard, against a fake instance. What each case is really about is which requests were made
   and in what order, so every one of them reads the recorded call list rather than only the answer. */
import assert from "node:assert/strict";
import test from "node:test";

import { Refusal, refusing } from "../../../../src/resolve/settings.mjs";
import { session } from "../../../../src/tools/services/coolify/client.mjs";
import { index } from "../../../../src/tools/services/coolify/routes.mjs";
import {
  active,
  applicationIds,
  check,
  environmentIds,
  filterList,
  makeScope,
} from "../../../../src/tools/services/coolify/scope.mjs";

const IN_SCOPE = { id: 100, uuid: "a-in", name: "web", environment_id: 10, status: "running:unhealthy" };
const OUTSIDE = { id: 200, uuid: "a-out", name: "theirs", environment_id: 99 };

const INSTANCE = {
  "/projects": [{ uuid: "p-in", id: 1, name: "ours" }, { uuid: "p-out", id: 2, name: "theirs" }],
  "/projects/p-in/environments": [{ id: 10, uuid: "e-10", name: "production" }],
  "/applications": [IN_SCOPE, OUTSIDE],
  "/applications/a-in": IN_SCOPE,
  "/applications/a-out": OUTSIDE,
  "/deployments": [{ id: 1, application_id: 100 }, { id: 2, application_id: 200 }],
};

const reply = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });

const stub = (t, instance = INSTANCE) => {
  const held = globalThis.fetch;
  const spoke = console.error;
  const asked = [];
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname.replace(/^\/api\/v1/u, "");
    asked.push(path);
    return Object.hasOwn(instance, path)
      ? reply(instance[path])
      : { ok: false, status: 404, text: async () => JSON.stringify({ message: "not found" }) };
  };
  console.error = () => {};
  t.after(() => {
    globalThis.fetch = held;
    console.error = spoke;
  });
  return asked;
};

const PIN = { at: "/work/web/.coolify.json", spec: { project_uuid: ["p-in"] } };

const scoped = (pin = PIN) =>
  makeScope(session({ url: "https://coolify.test/api/v1", token: "tok-1" }, {}), pin);

const refused = async (run) => {
  try {
    await refusing(run);
  } catch (error) {
    assert.ok(error instanceof Refusal, `threw ${error}`);
    return error.message;
  }
  return assert.fail("nothing was refused");
};

const GUARD = index().groups.app.commands.restart.scope;

test("a pin with no project is not a scope, and nothing runs under one", () => {
  assert.equal(active(scoped({ at: null, spec: {} })), false);
  assert.equal(active(scoped()), true);
});

test("the pin resolves to the environment ids of its own project and the applications in them", async (t) => {
  stub(t);
  const scope = scoped();
  assert.deepEqual([...(await environmentIds(scope))], [10]);
  assert.deepEqual([...(await applicationIds(scope))], [100]);
});

/* Some instances answer the environments route with nothing useful; the project's own embedded
   list is what both this and the guard then read, so the two cannot disagree about the pin. */
test("an empty environments route falls back to the environments the project itself carries", async (t) => {
  stub(t, { ...INSTANCE, "/projects/p-in/environments": [], "/projects/p-in": { uuid: "p-in", environments: [{ id: 11 }] } });
  assert.deepEqual([...(await environmentIds(scoped()))], [11]);
});

test("an application outside the pin is refused, and the refusal names it, the pin and the file", async (t) => {
  stub(t);
  const said = await refused(() => check(scoped(), GUARD, { uuid: "a-out" }));
  assert.match(said, /application a-out is outside the pinned project \(p-in\)/u);
  assert.match(said, /this checkout's scope comes from \/work\/web\/\.coolify\.json/u);
  assert.match(said, /there is no override/u);
});

/* The point of the guard is the order: the refusal comes out of working the target out, so the
   operation's own path is never among the requests made. */
test("nothing is asked of the refused resource's own action path", async (t) => {
  const asked = stub(t);
  await refused(() => check(scoped(), GUARD, { uuid: "a-out" }));
  assert.deepEqual(asked.filter((one) => one.includes("/restart")), []);
  assert.ok(asked.includes("/applications/a-out"), "the guard did look the resource up");
});

test("an application inside the pin is not refused", async (t) => {
  stub(t);
  await refusing(() => check(scoped(), GUARD, { uuid: "a-in" }));
});

test("a project uuid the pin does not name is refused as a project", async (t) => {
  stub(t);
  const guard = index().groups.project.commands.get.scope;
  assert.match(await refused(() => check(scoped(), guard, { uuid: "p-out" })), /project p-out is outside/u);
  await refusing(() => check(scoped(), guard, { uuid: "p-in" }));
});

/* Unknown to us is not refused: the real request produces the authoritative 404, and inventing one
   here would call a resource somebody else's on the strength of a lookup that failed. */
test("a uuid no collection answers for is left to the real request", async (t) => {
  stub(t);
  await refusing(() => check(scoped(), GUARD, { uuid: "a-nowhere" }));
});

test("a listing keeps what the pin holds and counts what it dropped", async (t) => {
  stub(t);
  const { kept, dropped } = await filterList(scoped(), "applications", [IN_SCOPE, OUTSIDE]);
  assert.deepEqual(kept.map((one) => one.uuid), ["a-in"]);
  assert.equal(dropped, 1);
});

/* A deployment names its application by integer id and carries no environment of its own, so the
   filter keyed on what the endpoint returns is the only one that can place it. */
test("deployments are filtered by the applications the pin holds, not by an environment", async (t) => {
  stub(t);
  const { kept, dropped } = await filterList(scoped(), "deployments", INSTANCE["/deployments"]);
  assert.deepEqual(kept.map((one) => one.id), [1]);
  assert.equal(dropped, 1);
});

test("a projects listing is cut to the projects the pin names", async (t) => {
  stub(t);
  const { kept, dropped } = await filterList(scoped(), "projects", INSTANCE["/projects"]);
  assert.deepEqual(kept.map((one) => one.uuid), ["p-in"]);
  assert.equal(dropped, 1);
});

/* An object carrying no such field says nothing about itself: dropping it would hide a shape this
   filter does not understand rather than one the pin excludes. */
test("an object with no linking field at all survives the filter", async (t) => {
  stub(t);
  const { kept, dropped } = await filterList(scoped(), "applications", [{ uuid: "x", name: "shapeless" }]);
  assert.deepEqual(kept.map((one) => one.uuid), ["x"]);
  assert.equal(dropped, 0);
});

/* A pin that resolves to nothing is the failure this whole module exists to prevent, reached by the
   very typo it names: the Python warns and carries on, which leaves the whole team in reach. */
test("a project uuid that resolves to no environment refuses rather than allowing everything", async (t) => {
  stub(t, { ...INSTANCE, "/projects/p-typo/environments": [], "/projects/p-typo": { uuid: "p-typo" } });
  const scope = scoped({ at: "/work/web/.coolify.json", spec: { project_uuid: ["p-typo"] } });
  const said = await refused(() => check(scope, GUARD, { uuid: "a-in" }));
  assert.match(said, /resolved to no environments/u);
  assert.match(said, /\/work\/web\/\.coolify\.json/u);
});

test("an environment restriction matching nothing refuses too, rather than widening to the team", async (t) => {
  stub(t);
  const scope = scoped({ at: "/work/web/.coolify.json", spec: { project_uuid: ["p-in"], environment: ["staging"] } });
  assert.match(await refused(() => check(scope, GUARD, { uuid: "a-in" })), /resolved to no environments/u);
});

test("a listing under an unresolvable pin refuses rather than printing every row", async (t) => {
  stub(t, { ...INSTANCE, "/projects/p-typo/environments": [], "/projects/p-typo": { uuid: "p-typo" } });
  const scope = scoped({ at: "/work/web/.coolify.json", spec: { project_uuid: ["p-typo"] } });
  assert.match(await refused(() => filterList(scope, "applications", [IN_SCOPE, OUTSIDE])),
    /resolved to no environments/u);
});

/* A listing that arrives wrapped beside a count is still a listing: without this the wrapper is not
   an array, so every row it holds would leave the filter untouched. */
test("rows wrapped beside a count are cut to the pin, not passed through whole", async (t) => {
  stub(t);
  const held = { count: 2, deployments: [{ id: 1, application_id: 100 }, { id: 2, application_id: 200 }] };
  const { kept, dropped } = await filterList(scoped(), "deployments", held);
  assert.deepEqual(kept.deployments.map((one) => one.id), [1]);
  assert.equal(kept.count, 2, "the wrapper's own fields survive");
  assert.equal(dropped, 1);
});

/* A listing with no guard of its own is held to the pin by this filter and by nothing else, so an
   answer the filter cannot place is rows nobody has checked. Printing them is the leak. */
test("a listing the pin cannot be applied to refuses rather than printing rows nothing placed", async (t) => {
  stub(t);
  const said = await refused(() =>
    filterList(scoped(), "applications", { applications: [OUTSIDE] }, { mustFilter: true }));
  assert.match(said, /a shape the pin cannot be applied to/u);
});

/* Where a guard already placed the target, an unplaceable answer is only a shape: `app logs`
   answers {logs: "..."} and its uuid was checked before the request went out. */
test("the same shape passes through where a guard, not the filter, placed the target", async (t) => {
  stub(t);
  const { kept } = await filterList(scoped(), "logs", { logs: "a line" });
  assert.deepEqual(kept, { logs: "a line" });
});

/* A dry run sent nothing, so there is no answer to place. That is not an answer this cannot place,
   and the two are told apart here or `--dry-run` stops working on every listing. */
test("the dry-run sentinel is not an answer the filter failed to place", async (t) => {
  stub(t);
  const { kept, dropped } = await filterList(scoped(), "applications", null, { mustFilter: true });
  assert.equal(kept, null);
  assert.equal(dropped, 0);
});

/* A lookup that came back with nothing is left to the real request's 404. A lookup that came back
   with an OBJECT establishing nothing is the other case: authorising it lets a real resource act
   on the strength of a reading that placed it nowhere. */
test("a resource that answers without the field that places it is refused, not authorised", async (t) => {
  const asked = stub(t, { ...INSTANCE, "/applications/a-odd": { uuid: "a-odd", name: "shapeless" } });
  const said = await refused(() => check(scoped(), GUARD, { uuid: "a-odd" }));
  assert.match(said, /answered without the field that would place it in a project/u);
  assert.deepEqual(asked.filter((one) => one.includes("/restart")), []);
});

test("a uuid nothing answers for is still left to the real request", async (t) => {
  stub(t);
  await refusing(() => check(scoped(), GUARD, { uuid: "a-nowhere" }));
});

/* Where this filter is the pin's only hold, a row it cannot place is a row nothing checked. It is
   counted apart from one that is somebody else's, because the two are different facts. */
test("an unplaceable row is withheld under strict filtering and counted on its own", async (t) => {
  stub(t);
  const cut = await filterList(scoped(), "applications",
    [IN_SCOPE, OUTSIDE, { uuid: "a-odd", name: "shapeless" }], { mustFilter: true });
  assert.deepEqual(cut.kept.map((one) => one.uuid), ["a-in"]);
  assert.equal(cut.dropped, 1, "one row was somebody else's");
  assert.equal(cut.unplaced, 1, "one row could not be placed at all");
});

test("the same row survives where a guard, not the filter, placed the target", async (t) => {
  stub(t);
  const cut = await filterList(scoped(), "applications", [{ uuid: "a-odd", name: "shapeless" }]);
  assert.deepEqual(cut.kept.map((one) => one.uuid), ["a-odd"]);
  assert.equal(cut.unplaced, 0);
});
