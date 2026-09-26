/* What the verb serves, and the guard-coverage property that decides whether an operation may be
   served at all. The index is a shipped file, so these read it rather than a fixture of it. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../../fixtures.mjs";
import { TAKEN_HERE } from "../../../../src/tools/services/coolify/chosen-route.mjs";

import {
  ALIASES,
  SERVED,
  holes,
  index,
  reachable,
  resolveCommand,
  servedNames,
} from "../../../../src/tools/services/coolify/routes.mjs";

const SOURCE = "/home/thanh/.claude/coolify-plugin/plugins/coolify/data/routes.json";
const SHIPPED = new URL("../../../../src/tools/services/coolify/routes.json", import.meta.url).pathname;

/* The index is carried rather than retyped, and the only way to say so is to compare the bytes.
   Where the source plugin is not installed the case says so instead of passing on nothing. */
test("the shipped route index is byte for byte the one the Python CLI generated", (t) => {
  let held;
  try {
    held = readFileSync(SOURCE);
  } catch {
    t.skip("the Coolify plugin is not installed on this machine");
    return;
  }
  assert.ok(held.equals(readFileSync(SHIPPED)), "the shipped index has been edited since it was copied");
});

test("every served name is an operation the index actually holds", () => {
  for (const name of SERVED) {
    const [group, ...rest] = name.split(" ");
    assert.ok(index().groups[group], `${name} names a group the index has not got`);
    assert.ok(Object.hasOwn(index().groups[group].commands, rest.join(" ")), `${name} is not in the index`);
  }
});

test("every served operation has a form the pin can vouch for", () => {
  for (const name of SERVED) {
    const [group, ...rest] = name.split(" ");
    assert.ok(reachable(index().groups[group].commands[rest.join(" ")]), `${name} has no guarded form`);
  }
  assert.deepEqual(servedNames(), SERVED);
});

/* The rule has to be watched firing, and no shipped operation is in this class — so the case
   builds one, which is what a new group arriving unguarded and unfiltered would look like. */
test("an operation that neither filters its answer nor guards its selector is not served", () => {
  const loose = { method: "POST", path: "/x/{uuid}", params: [{ name: "uuid", in: "path" }], scope: [] };
  assert.equal(reachable(loose), false);
  assert.deepEqual(holes(loose), ["uuid"]);
});

/* A `returns` is not on its own a tie to the pin: an operation that acts has already acted by the
   time there is a list to cut down, so the method is half the test. */
test("an operation that acts is not excused its guard by declaring a return shape", () => {
  const acting = {
    method: "POST",
    path: "/x",
    returns: "applications",
    params: [{ name: "uuid", in: "query" }],
    scope: [],
  };
  assert.deepEqual(holes(acting), ["uuid"]);
  assert.equal(reachable(acting), false);
  assert.deepEqual(holes({ ...acting, method: "GET" }), [], "a read that lists is tied by the filter");
});

/* `app list` takes the same tag and is not a hole: its answer comes back as a list the pin cuts
   down, so the tag widens the query and the filter narrows the result. */
test("deploy is the one served operation with a selector nothing ties to the pin", () => {
  const loose = SERVED.filter((name) => {
    const [group, ...rest] = name.split(" ");
    return holes(index().groups[group].commands[rest.join(" ")]).length > 0;
  });
  assert.deepEqual(loose, ["deploy"]);
  assert.deepEqual(holes(index().groups.deploy.commands[""]), ["tag"]);
  assert.deepEqual(holes(index().groups.app.commands.list), []);
});

test("each operation of the deploy path resolves to its own method and path", () => {
  const wanted = {
    "app list": ["GET", "/applications"],
    "app get": ["GET", "/applications/{uuid}"],
    "app logs": ["GET", "/applications/{uuid}/logs"],
    "app env list": ["GET", "/applications/{uuid}/envs"],
    "app env create": ["POST", "/applications/{uuid}/envs"],
    "app env update": ["PATCH", "/applications/{uuid}/envs"],
    "app restart": ["POST", "/applications/{uuid}/restart"],
    deploy: ["POST", "/deploy"],
    "deployment list": ["GET", "/deployments"],
    "deployment get": ["GET", "/deployments/{uuid}"],
  };
  for (const [name, [method, path]] of Object.entries(wanted)) {
    const { entry } = resolveCommand(name.split(" "));
    assert.equal(entry.method, method, name);
    assert.equal(entry.path, path, name);
  }
});

test("the longer command wins the shared head, and its own argv comes back untouched", () => {
  const found = resolveCommand(["app", "env", "list", "a1", "--full"]);
  assert.equal(found.name, "app env list");
  assert.deepEqual(found.rest, ["a1", "--full"]);
  assert.equal(resolveCommand(["app", "list"]).name, "app list");
});

test("each alias expands to a served name and carries the rest of argv with it", () => {
  for (const [alias, name] of Object.entries(ALIASES)) {
    assert.ok(SERVED.includes(name), `${alias} expands to ${name}, which is not served`);
  }
  const found = resolveCommand(["logs", "a1", "--lines", "50"]);
  assert.equal(found.name, "app logs");
  assert.deepEqual(found.rest, ["a1", "--lines", "50"]);
});

/* The generator withheld these, so they are not in the index at all: nothing here filters them
   out, and the case is what says they never arrived. */
test("a group the index does not hold is unknown, not withheld at dispatch", () => {
  for (const group of ["server", "private-key", "team", "destination", "tag", "database"]) {
    const found = resolveCommand([group, "list"]);
    assert.equal(found.kind, "group", `${group} resolved to something`);
    assert.equal(found.unknown, group);
  }
});

test("an operation the index holds but this release does not serve is named as unserved", () => {
  const found = resolveCommand(["app", "delete", "a1"]);
  assert.equal(found.kind, "unserved");
  assert.equal(found.unknown, "app delete");
});

/* The two the env group keeps back, beside the two it now serves: deleting is not offered at all,
   and the bulk form takes a list a command line has no way to spell. */
test("the environment operations this release keeps back are named as unserved, not as unknown", () => {
  for (const name of ["app env delete", "app env update-bulk"]) {
    const found = resolveCommand(name.split(" "));
    assert.equal(found.kind, "unserved", `${name} resolved to something else`);
    assert.equal(found.unknown, name);
  }
  for (const name of ["app env create", "app env update"]) {
    assert.ok(servedNames().includes(name), `${name} is not served`);
  }
});

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

/* Every case below is about the operations the route index declares, which is the saved instance's
   route, so the home each spawn reads chooses it: under the default this verb answers over the
   tracker and none of these names is one of its own. */
const homeFor = (mode) => {
  const room = tempRoom(`coolify-surface-${mode}-`);
  mkdirSync(join(room, "forge"));
  writeFileSync(join(room, "forge", "config.json"), JSON.stringify({ coolifyRoute: mode }));
  return room;
};

const INSTANCE_HOME = homeFor("instance");
const TRACKER_HOME = homeFor("tracker");

const ranIn = (home, ...argv) =>
  execFileSync(FORGE, argv, { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: home } });

const ranHelp = (...argv) => ranIn(INSTANCE_HOME, ...argv);

test("the verb's own listing names every sub-verb, and each of them answers a help ask", () => {
  const listed = ranHelp("coolify", "-h");
  for (const subject of ["login", "accounts", "whoami", "pin", "app", "deploy", "deployment", "project", "resource"]) {
    assert.match(listed, new RegExp(subject, "u"), `${subject} is not on the verb's own listing`);
    assert.match(ranHelp("coolify", subject, "-h"), /^Usage: forge coolify /u, `${subject} has no text of its own`);
  }
});

/* The other route's listing is its own, and the two do not overlap beyond the credential's two. */
test("on the tracker route the listing names that route's own names, each with a text of its own", () => {
  const listed = ranIn(TRACKER_HOME, "coolify", "-h");
  for (const subject of TAKEN_HERE) {
    assert.match(listed, new RegExp(subject, "u"), `${subject} is not on the tracker route's listing`);
    assert.match(ranIn(TRACKER_HOME, "coolify", subject, "-h"), /^Usage: forge coolify /u,
      `${subject} has no text of its own`);
  }
  for (const subject of ["whoami", "app", "deployment", "resource"]) {
    assert.doesNotMatch(listed.split("\n")[0], new RegExp(subject, "u"),
      `${subject} is offered by a route that refuses it`);
  }
});

const refusedOf = (...argv) => {
  try {
    ranHelp(...argv);
  } catch (stopped) {
    return `${stopped.stdout ?? ""}${stopped.stderr ?? ""}`;
  }
  return assert.fail(`${argv.join(" ")} was not refused`);
};

/* The refusal lists what the verb does serve, so it is also where a caller reaching for the bulk
   form learns the two that are there. */
test("an unserved environment operation is refused with the two served writes among what it names", () => {
  const said = refusedOf("coolify", "app", "env", "update-bulk", "a1");
  assert.match(said, /is in the route index but is not one of the operations this verb serves/u);
  assert.match(said, /app env create/u);
  assert.match(said, /app env update/u);
});

/* Two listings carry them, and `coolify -h` is neither: that one is the top-level CLI's own row for
   the verb, two lines long, and the verb's own rows come from the bare call instead. */
test("both environment writes are named by the app usage and by the verb's own row", () => {
  const app = ranHelp("coolify", "app", "-h");
  assert.match(app, /env create\|env update/u);
  assert.match(app, /--key K/u);
  assert.match(app, /--value V/u);
  assert.match(refusedOf("coolify"), /app +list, get, logs, env list, env create, env update, restart, start, stop/u);
});
