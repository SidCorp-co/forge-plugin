/* Every surface that names a coolify subcommand reads it off one row, on both routes, in
   `chosen-route.mjs`. Each case holds a consumer against what the rows derive, so a name, a usage or
   a flag typed a second time anywhere else is a mismatch here rather than a help line that quietly
   offers what the verb refuses. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
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

const chose = (mode) => {
  if (mode === null) delete userConfig().coolifyRoute;
  else userConfig().coolifyRoute = mode;
};

/* A hook loads the rows through `visibility.mjs`, so the rows' module may pull in no other file of
   this directory: `coolify.mjs` and the instance client are what a hook must never load. */
test("loading the rows loads no other module of the coolify directory", () => {
  const probe = [
    'import { registerHooks } from "node:module";',
    "const seen = [];",
    "registerHooks({ resolve: (spec, context, next) => { const found = next(spec, context); seen.push(found.url); return found; } });",
    `await import(${JSON.stringify(ROWS_FILE.href)});`,
    'console.log(JSON.stringify(seen.filter((one) => one.includes("/services/coolify/"))));',
  ].join("\n");
  const loaded = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", probe],
    { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: HOME } }));
  assert.deepEqual(loaded, [ROWS_FILE.href]);
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

/* Not a subcommand, and one list all the same: the fields a pin holds. The reader takes them and the
   project-file write refuses any field beside them, naming the list, so the two cannot drift into a
   pin that writes what nothing reads. */
test("a field under coolifyPin outside the pin's own fields is refused naming them", async () => {
  const { PROJECT_KEYS } = await import("../../../../src/tools/services/project-file.mjs");
  const { PIN_FIELDS } = await import("../../../../src/tools/services/coolify/config.mjs");
  const judged = PROJECT_KEYS.coolifyPin.judge({ project_uuid: ["p-in"], stray: "x" });
  assert.match(judged, /`coolifyPin\.stray` .* is read by nothing: the pin holds /u);
  assert.ok(judged.endsWith(`${PIN_FIELDS.join(" and ")} alone.`), judged);
  assert.equal(PROJECT_KEYS.coolifyPin.judge(Object.fromEntries(PIN_FIELDS.map((one) => [one, ["v"]]))), null,
    "every field the reader takes is one the write lets through");
});
