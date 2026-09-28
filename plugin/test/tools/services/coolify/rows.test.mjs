/* Every surface that names a coolify subcommand reads it off one row, on both routes, in
   `chosen-route.mjs`. Each case holds a consumer against what the rows derive, so a name, a usage or
   a flag typed a second time anywhere else is a mismatch here rather than a help line that quietly
   offers what the verb refuses. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { tempRoom } from "../../../fixtures.mjs";

/* A config of this suite's own before anything reads one: the route is read off it. */
const HOME = tempRoom("coolify-rows-home-");
mkdirSync(join(HOME, "forge"));
writeFileSync(join(HOME, "forge", "config.json"), JSON.stringify({}));
process.env.XDG_CONFIG_HOME = HOME;

const { userConfig } = await import("../../../../src/resolve/config.mjs");
const route = await import("../../../../src/tools/services/coolify/chosen-route.mjs");
const rows = route;
const { TRACKER_SAYS, TRACKER_USAGE } = await import("../../../../src/tools/services/coolify/tracker.mjs");
const { SAYS, USAGE } = await import("../../../../src/tools/services/coolify/coolify.mjs");
const { usageOf } = await import("../../../../src/resolve/visibility.mjs");
const { ROUTES } = await import("../../../../src/tracker/routes.mjs");

const ROWS_FILE = new URL("../../../../src/tools/services/coolify/chosen-route.mjs", import.meta.url);

/* A hook loads the rows' file through `visibility.mjs`: two of these that file loads itself, and the
   third is the transport's no-route table, which imports nothing. */
const LIGHT = ["../../../resolve/config.mjs", "../../../resolve/settings.mjs",
  "../../../tracker/declared/no-route.mjs"];

const NO_ROUTE_FILE = new URL("../../../../src/tracker/declared/no-route.mjs", import.meta.url);

const chose = (mode) => {
  if (mode === null) delete userConfig().coolifyRoute;
  else userConfig().coolifyRoute = mode;
};

test("the rows' file imports nothing heavier than a table", () => {
  const imported = [...readFileSync(ROWS_FILE, "utf8").matchAll(/^import .* from "([^"]+)";$/gmu)].map((one) => one[1]);
  assert.deepEqual(imported, LIGHT);
  const visibility = readFileSync(new URL("../../../../src/resolve/visibility.mjs", import.meta.url), "utf8");
  for (const held of ["./config.mjs", "./settings.mjs"]) {
    assert.ok(visibility.includes(`from "${held}"`), `visibility.mjs no longer loads ${held} itself`);
  }
  assert.doesNotMatch(readFileSync(NO_ROUTE_FILE, "utf8"), /^import\b/mu, "the no-route table imports nothing");
});

test("each tracker row names a route the table holds, and the served map is the rows'", () => {
  assert.deepEqual(route.TRACKER_SERVED, Object.fromEntries(rows.TRACKER_ROWS.map((row) => [row.name, row.key])));
  for (const row of rows.TRACKER_ROWS) {
    assert.ok(ROUTES[row.key], `${row.name} names ${row.key}, which the route table does not hold`);
    assert.deepEqual(Object.values(row.takes).filter((field) => !ROUTES[row.key].sends.includes(field)), [],
      `${row.name} maps a flag onto an argument its route does not send`);
  }
});

test("the tracker route's names, usage and per-subcommand help are the rows'", () => {
  assert.deepEqual(route.TAKEN_HERE, [...rows.TRACKER_BOTH, ...rows.TRACKER_ROWS].map((row) => row.name));
  assert.deepEqual(TRACKER_SAYS, Object.fromEntries(rows.TRACKER_ROWS.map((row) => [row.name, row.usage])));
  const [first, ...rest] = TRACKER_USAGE.split("\n");
  assert.equal(first, `Usage: forge coolify <${route.TAKEN_HERE.join("|")}> [args]`);
  for (const line of rows.summaryLines([...rows.TRACKER_BOTH, ...rows.TRACKER_ROWS])) {
    assert.ok(rest.includes(line), `the tracker usage lacks the row's own line: ${line}`);
  }
  assert.ok(TRACKER_USAGE.includes(`${rows.listed(route.REFUSED_HERE)} are refused here`),
    "the names turned away are the ones the refusal tables hold");
});

test("the instance route's names, usage and per-subcommand help are the rows'", () => {
  assert.deepEqual(route.INSTANCE_NAMES, rows.INSTANCE_ROWS.map((row) => row.name));
  assert.deepEqual(SAYS, Object.fromEntries(rows.INSTANCE_ROWS.map((row) => [row.name, row.usage])));
  const [first, ...rest] = USAGE.split("\n");
  assert.equal(first, `Usage: forge coolify <${route.INSTANCE_NAMES.join("|")}> [args]`);
  for (const line of rows.summaryLines(rows.INSTANCE_ROWS)) {
    assert.ok(rest.includes(line), `the instance usage lacks the row's own line: ${line}`);
  }
});

test("the verb's row in forge -h names the rows of whichever route answers", () => {
  chose(null);
  assert.equal(usageOf("coolify"), `Usage: forge coolify <${route.TAKEN_HERE.join("|")}>`);
  chose("instance");
  assert.equal(usageOf("coolify"), `Usage: forge coolify <${route.INSTANCE_NAMES.join("|")}>`);
  chose(null);
});

test("the names refused as routeless are the no-route table's, and a mistyped route is carried", () => {
  assert.deepEqual(route.REFUSED_HERE.slice(0, Object.keys(route.ROUTELESS).length), Object.keys(route.ROUTELESS));
  chose("trackr");
  assert.deepEqual({ ...route.coolifyRoute(), from: undefined },
    { value: route.TRACKER, from: undefined, unknown: "trackr" });
  assert.equal(route.onTracker(), true, "a value the key does not take answers as the default does");
  chose(null);
});
