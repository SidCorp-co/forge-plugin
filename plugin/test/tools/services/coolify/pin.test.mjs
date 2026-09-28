/* The route from a saved instance to a pinned checkout, end to end against a fake instance this suite
   runs, in a configuration home of its own. What a case judges is what landed in this machine's
   record of the project, read off the disk, and which requests left. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { projectEntry, projectRecord, projectRoom, ranAsync, tempRoom } from "../../../fixtures.mjs";

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

const TOKEN = "coolify-pin-sentinel-7c1";

const WEB = { uuid: "a-web", id: 100, name: "Web", environment_id: 11 };

const ANSWERS = {
  "/projects": [
    { uuid: "p-in", id: 1, name: "ours" },
    { uuid: "p-two", id: 2, name: "dupe" },
    { uuid: "p-three", id: 3, name: "Dupe" },
  ],
  "/projects/p-in/environments": [{ id: 10, uuid: "e-10", name: "production" }, { id: 11, uuid: "e-11", name: "staging" }],
  "/projects/p-two/environments": [{ id: 20, uuid: "e-20", name: "production" }],
  "/projects/p-three/environments": [],
  "/projects/p-three": { uuid: "p-three", environments: [] },
  "/applications": [
    WEB,
    { uuid: "a-twin-1", id: 201, name: "twin", environment_id: 10 },
    { uuid: "a-twin-2", id: 202, name: "twin", environment_id: 20 },
    { uuid: "a-lost", id: 300, name: "lost", environment_id: 77 },
  ],
};

let server = null;
let home = null;
let asked = [];

before(async () => {
  server = createServer((request, response) => {
    const path = new URL(request.url, "http://x").pathname.replace(/^\/api\/v1/u, "");
    asked.push({ method: request.method, path });
    const known = request.method === "GET" && Object.hasOwn(ANSWERS, path);
    response.writeHead(known ? 200 : 404, { "Content-Type": "application/json" });
    response.end(JSON.stringify(known ? ANSWERS[path] : { message: `no route ${path}` }));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  home = tempRoom("coolify-pin-home-");
  mkdirSync(join(home, "forge"));
  writeFileSync(join(home, "forge", "config.json"), JSON.stringify({
    coolifyRoute: "instance",
    coolify: { url: `http://127.0.0.1:${server.address().port}`, apiToken: TOKEN },
  }));
});

after(() => server?.close());

/* A checkout of its own per case, holding a record with a slug and whatever pin the case starts at. */
const checkout = (name, coolify) =>
  projectRoom(tempRoom(`coolify-pin-${name}-`), home, { slug: name, ...(coolify ? { coolifyPin: coolify } : {}) });

const ran = async (room, ...argv) => {
  asked = [];
  const answer = await ranAsync(FORGE, ["coolify", ...argv], { ...process.env, XDG_CONFIG_HOME: home, NO_COLOR: "1" }, room);
  return { ...answer, asked };
};

const recorded = (room) => JSON.parse(readFileSync(projectEntry(room, home), "utf8"));

test("an application's name pins the project and the environment holding it, and the verb then answers inside it", async () => {
  const room = checkout("by-app");
  const pinned = await ran(room, "pin", "--app", "web");
  assert.equal(pinned.status, 0, pinned.stderr);
  assert.match(pinned.stdout, /application Web is in project ours \(p-in\), environment staging/u);
  assert.deepEqual(recorded(room).coolifyPin, { project_uuid: ["p-in"], environment: ["staging"] });
  assert.equal(recorded(room).slug, "by-app", "the pin's write dropped a key beside it");
  assert.ok(!pinned.stdout.includes(TOKEN) && !pinned.stderr.includes(TOKEN));

  const listed = await ran(room, "apps", "--json");
  assert.equal(listed.status, 0, listed.stderr);
  assert.deepEqual(JSON.parse(listed.stdout).map((one) => one.uuid), ["a-web"]);
});

test("a project pins with no environment filter, and --environment beside it becomes the filter", async () => {
  const bare = checkout("by-project");
  const whole = await ran(bare, "pin", "--project", "ours");
  assert.equal(whole.status, 0, whole.stderr);
  assert.deepEqual(recorded(bare).coolifyPin, { project_uuid: ["p-in"] });

  const narrowed = checkout("by-project-env");
  const one = await ran(narrowed, "pin", "--project", "p-in", "--environment", "production");
  assert.equal(one.status, 0, one.stderr);
  assert.deepEqual(recorded(narrowed).coolifyPin, { project_uuid: ["p-in"], environment: ["production"] });
});

test("with neither flag the pin is refused naming both, listing the projects this token can see", async () => {
  const room = checkout("empty");
  const answer = await ran(room, "pin");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /--app <name\|uuid>/u);
  assert.match(answer.stderr, /--project <name\|uuid>/u);
  for (const [uuid, name] of [["p-in", "ours"], ["p-two", "dupe"], ["p-three", "Dupe"]]) {
    assert.match(answer.stderr, new RegExp(`${uuid} {2}${name}`, "u"));
  }
  assert.equal(recorded(room).coolifyPin, undefined);
});

test("a name two applications or two projects share is refused with each uuid, and nothing is written", async () => {
  const room = checkout("ambiguous", { project_uuid: ["p-in"] });
  const apps = await ran(room, "pin", "--app", "twin", "--yes");
  assert.equal(apps.status, 1);
  assert.match(apps.stderr, /`twin` names 2 applications/u);
  assert.match(apps.stderr, /a-twin-1 {2}twin/u);
  assert.match(apps.stderr, /a-twin-2 {2}twin/u);

  const projects = await ran(room, "pin", "--project", "dupe", "--yes");
  assert.equal(projects.status, 1);
  assert.match(projects.stderr, /`dupe` names 2 projects/u);
  assert.match(projects.stderr, /p-two {2}dupe/u);
  assert.match(projects.stderr, /p-three {2}Dupe/u);
  assert.deepEqual(recorded(room).coolifyPin, { project_uuid: ["p-in"] });
});

test("a part of a name matches nothing, so no project is guessed", async () => {
  const room = checkout("partial");
  const answer = await ran(room, "pin", "--project", "our");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /no project this token can see is named or numbered `our`/u);
  assert.equal(recorded(room).coolifyPin, undefined);
});

test("a different pin already recorded is shown beside the new one and kept without --yes", async () => {
  const room = checkout("replace", { project_uuid: ["p-two"] });
  const refused = await ran(room, "pin", "--app", "web");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /already pins \{"project_uuid":\["p-two"\]\}/u);
  assert.match(refused.stderr, /replace it with \{"project_uuid":\["p-in"\],"environment":\["staging"\]\}/u);
  assert.match(refused.stderr, /with --yes/u);
  assert.deepEqual(recorded(room).coolifyPin, { project_uuid: ["p-two"] });

  const replaced = await ran(room, "pin", "--app", "web", "--yes");
  assert.equal(replaced.status, 0, replaced.stderr);
  assert.deepEqual(recorded(room).coolifyPin, { project_uuid: ["p-in"], environment: ["staging"] });
});

test("--dry-run prints the pin and the record it would go to, and writes nothing", async () => {
  const room = checkout("dry");
  const answer = await ran(room, "pin", "--project", "ours", "--dry-run");
  assert.equal(answer.status, 0, answer.stderr);
  assert.ok(answer.stdout.includes(`would pin {"project_uuid":["p-in"]}  → ${projectEntry(room, home)}`), answer.stdout);
  assert.equal(recorded(room).coolifyPin, undefined);
});

/* The typo the guard exists for, as the instance really answers it: a project uuid it does not know
   is a 404, and the refusal that follows has to name a command the same state lets run. */
test("a pin naming a project the instance does not know is refused naming the pin, which then answers", async () => {
  const room = checkout("typo", { project_uuid: ["p-typo"] });
  const refused = await ran(room, "apps");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /resolved to no environments/u);
  assert.match(refused.stderr, /forge coolify pin --app <name\|uuid>/u);
  assert.doesNotMatch(refused.stderr, /HTTP 404/u);

  const listed = await ran(room, "pin");
  assert.match(listed.stderr, /p-in {2}ours/u, "the command the refusal named did not answer under that pin");
  const repinned = await ran(room, "pin", "--project", "ours", "--yes");
  assert.equal(repinned.status, 0, repinned.stderr);
  assert.deepEqual(recorded(room).coolifyPin, { project_uuid: ["p-in"] });
});

test("an application whose environment no visible project holds is refused, and nothing is written", async () => {
  const room = checkout("lost");
  const answer = await ran(room, "pin", "--app", "lost");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /answered environment 77, which no project this token can see holds/u);
  assert.equal(recorded(room).coolifyPin, undefined);
});

test("--app with a project flag beside it is refused before anything is sent", async () => {
  const room = checkout("mixed");
  const answer = await ran(room, "pin", "--app", "web", "--project", "ours");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /--app settles the project and the environment both/u);
  assert.deepEqual(answer.asked, []);
});

test("from a directory in no checkout the pin is refused with no request sent", async () => {
  const nowhere = tempRoom("coolify-pin-nowhere-");
  const answer = await ran(nowhere, "pin", "--app", "web");
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /belongs to no checkout, so there is no project record to write a pin to/u);
  assert.deepEqual(answer.asked, []);
});

test("--set of a coolify key is refused naming the pin, and the record is left as it was", async () => {
  const room = checkout("set", { project_uuid: ["p-in"] });
  const before = readFileSync(projectEntry(room, home), "utf8");
  const answer = await ranAsync(FORGE, ["doctor", "--set", "coolifyPin.project_uuid=p-two"],
    { ...process.env, XDG_CONFIG_HOME: home }, room);
  assert.equal(answer.status, 1);
  assert.match(answer.stderr, /`coolifyPin\.project_uuid` is written by forge coolify pin --app <name>/u);
  assert.equal(readFileSync(projectEntry(room, home), "utf8"), before);
});

test("the doctor row names the record the pin was read from", async () => {
  const room = checkout("doctor", { project_uuid: ["p-in"] });
  const entry = projectEntry(room, home);
  assert.ok(existsSync(entry));
  projectRecord(room, home, { slug: "doctor", coolifyPin: { project_uuid: ["p-in"] } });
  const answer = await ranAsync(FORGE, ["doctor"], { ...process.env, XDG_CONFIG_HOME: home }, room);
  const said = `${answer.stdout}${answer.stderr}`;
  assert.ok(said.includes(`project p-in  ← ${entry}`), said);
});
