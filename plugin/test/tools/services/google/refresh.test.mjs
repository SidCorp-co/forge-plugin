/* The refresh against Discovery documents the fake serves, rebuilt from the carried indexes so the
   case controls exactly what moved: one method added, one of an unserved service dropped, one changed,
   and in the last cases a served one dropped, refused until its line is out of the index compared
   against. Every write goes to a directory of the case's own. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../../fixtures.mjs";
import { SERVICES, carriedIndex } from "../../../../src/tools/services/google/surface.mjs";
import { google, googleHome, startFake } from "./fake.mjs";

let fake = null;
let home = null;
let into = null;

const methodOf = (one) => ({ httpMethod: one.http, path: one.path,
  parameters: Object.fromEntries(Object.entries(one.params ?? {}).map(([name, held]) => [name, { location: held.in, type: held.type }])) });

/* A Discovery document whose resources hold exactly the carried index's methods, as edited. */
const documentOf = (service, edit = (methods) => methods) => {
  const index = carriedIndex(service);
  const document = { name: index.api, version: index.version, revision: "29990101", rootUrl: index.rootUrl,
    servicePath: index.servicePath, parameters: {}, resources: {} };
  for (const [id, one] of Object.entries(edit({ ...index.methods }))) {
    const parts = id.split(".").slice(1);
    let at = document;
    for (const name of parts.slice(0, -1)) {
      at.resources ??= {};
      at = at.resources[name] ??= {};
    }
    at.methods ??= {};
    at.methods[parts.at(-1)] = methodOf(one);
  }
  return document;
};

const serve = (edits = {}) => {
  for (const [service, { discovery }] of Object.entries(SERVICES)) {
    const path = new URL(discovery).pathname;
    fake.answers[`GET ${path}`] = (seen) => {
      const asked = path === "/$discovery/rest" ? seen.query.get("version") : null;
      const which = asked ? Object.keys(SERVICES).find((one) => SERVICES[one].discovery.endsWith(`version=${asked}`)) : service;
      return [200, documentOf(which, edits[which])];
    };
  }
};

const written = () => Object.fromEntries(readdirSync(into).map((name) => [name, readFileSync(join(into, name), "utf8")]));

before(async () => {
  fake = await startFake();
  home = googleHome(fake);
  into = tempRoom("google-discovery-");
});

after(() => fake?.close());

const ran = (...argv) => google(home, ["discovery", ...argv, "--dir", into]);

test("--write writes one index a service from the fetched documents", async () => {
  serve();
  const answer = await ran("--write");
  assert.equal(answer.status, 0, answer.stderr);
  assert.deepEqual(Object.keys(written()).sort(), Object.keys(SERVICES).map((one) => `${one}.json`).sort());
});

const MOVED = {
  drive: (methods) => ({ ...methods, "drive.files.brandNew": { http: "GET", path: "files/new" },
    "drive.about.get": { ...methods["drive.about.get"], path: "about/moved" } }),
  chat: (methods) => {
    const { "chat.customEmojis.create": gone, ...rest } = methods;
    assert.ok(gone);
    return rest;
  },
};

test("without --write it prints, per service, what was added, removed and changed, and writes nothing", async () => {
  const before = written();
  serve(MOVED);
  const answer = await ran();
  assert.equal(answer.status, 0, answer.stderr);
  const lines = answer.stdout.trim().split("\n").map((one) => JSON.parse(one));
  const drive = lines.find((one) => one.service === "drive");
  assert.deepEqual(drive.added, ["drive.files.brandNew"]);
  assert.deepEqual(drive.removed, []);
  assert.deepEqual(drive.changed, ["drive.about.get"]);
  assert.deepEqual(lines.find((one) => one.service === "chat").removed, ["chat.customEmojis.create"]);
  assert.deepEqual(lines.find((one) => one.service === "gmail"), { service: "gmail",
    revision: { carried: "29990101", fetched: "29990101" }, added: [], removed: [], changed: [] });
  assert.deepEqual(written(), before);
});

const WITHOUT_LIST = { drive: (methods) => {
  const { "drive.files.list": gone, ...rest } = methods;
  assert.ok(gone);
  return rest;
} };

test("a fetch that drops a served method is refused with 4 naming it, and nothing is written", async () => {
  const before = written();
  serve(WITHOUT_LIST);
  const answer = await ran("--write");
  assert.equal(answer.status, 4);
  assert.match(answer.stderr, /drop 1 served method\(s\): drive\.files\.list\./u);
  assert.ok(answer.stderr.includes(`take each one's line out of ${join(into, "drive.json")} in a commit first`), answer.stderr);
  assert.match(answer.stderr, /nothing was written/u);
  assert.deepEqual(written(), before);
});

test("once the dropped method's line is out of the index compared against, the same write writes", async () => {
  const at = join(into, "drive.json");
  writeFileSync(at, readFileSync(at, "utf8").split("\n").filter((line) => !line.startsWith('  "drive.files.list":')).join("\n"));
  serve(WITHOUT_LIST);
  const answer = await ran("--write");
  assert.equal(answer.status, 0, answer.stderr);
  assert.ok(!readFileSync(at, "utf8").includes('"drive.files.list"'));
});
