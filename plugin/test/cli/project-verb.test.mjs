/* The one verb outside any project's scope: every other reads the project the checkout names, and
   this acts on the records that naming picks between. Spawned, because what is judged is the answer
   a developer reads and the refusals that arrive before any call goes out. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;
const PASSWORD = "correct-horse-battery";

const rows = [
  { id: "11111111-1111-4111-8111-111111111111", slug: "forge-plugin", name: "the plugin", archivedAt: null },
  { id: "22222222-2222-4222-8222-222222222222", slug: "sid-erp", name: "the product", archivedAt: null },
  { id: "33333333-3333-4333-8333-333333333333", slug: "old-thing", name: "retired", archivedAt: "2026-01-02T00:00:00.000Z" },
];

const state = {
  answer: {
    "forge_projects.list": (args) => ({
      projects: args.archived ? rows : rows.filter((one) => !one.archivedAt),
    }),
    "forge_projects.read": (args) => ({
      ...rows.find((one) => one.id === args.projectRef),
      description: "the tracker's own plugin",
      role: "admin",
      createdAt: "2026-09-02T07:29:19.097Z",
      previewDeploy: { stagingUrl: "https://beta.example.test", testCredentials: [{ password: PASSWORD }] },
    }),
    "forge_projects.create": (args) => ({ id: "44444444-4444-4444-8444-444444444444", ...args.data, archivedAt: null }),
    "forge_projects.update": (args) => ({ ...rows[0], ...args.data }),
    "forge_projects.archive": () => ({ ...rows[0], archivedAt: "2026-09-08T00:00:00.000Z" }),
    "forge_projects.unarchive": () => ({ ...rows[0], archivedAt: null }),
    forge_guide: () => ({ guides: [] }),
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const ask = (...argv) => ranAsync(FORGE, ["project", ...argv], tracker.env, ROOT);

test("the list is one line per project and says which of them are archived", async () => {
  const run = await ask();
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^forge-plugin\s+the plugin$/mu);
  assert.match(run.stdout, /^sid-erp\s+the product$/mu);
  assert.match(run.stdout, /^old-thing\s+retired {2}\(archived\)$/mu,
    "the archived are listed, because the project to unarchive is one the plain list cannot name");
});

test("a project's record is printed with its test credentials withheld", async () => {
  const run = await ask("forge-plugin");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^slug: forge-plugin$/mu);
  assert.match(run.stdout, /^description: the tracker's own plugin$/mu);
  assert.match(run.stdout, /^role: admin$/mu);
  assert.match(run.stdout, /^created: 2026-09-02$/mu);
  assert.match(run.stdout, /^archived: no$/mu);
  assert.match(run.stdout, /^ {2}staging url: https:\/\/beta\.example\.test$/mu);
  assert.match(run.stdout, /^ {2}held, not printed: test credentials · password$/mu);
  assert.doesNotMatch(run.stdout, new RegExp(PASSWORD, "u"),
    "a project row carries the credentials whole, so printing the row would print them");
});

test("the record is read off the route for the project named, not the one the checkout scopes", async () => {
  state.calls = [];
  await ask("sid-erp");
  const read = state.calls.find((one) => one.name === "forge_projects.read");
  assert.ok(read, "the by-reference route is what a named project is read through");
  assert.equal(read.path, "/api/projects/22222222-2222-4222-8222-222222222222",
    "the slug is resolved against the list and the id is what the route carries");
});

test("a slug nothing matches is answered with the nearest and nothing is written", async () => {
  const run = await ask("forge-plugn");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^No project named forge-plugn\. Did you mean: forge-plugin\?/mu);
  assert.match(run.stderr, /The set is forge-plugin, old-thing, sid-erp\./u,
    "read off the list that carries the archived too, since one of those is what --unarchive names");
});

test("a project is created from a name and a slug, and its record is printed back", async () => {
  const run = await ask("new", "--name", "A new thing", "--slug", "a-new-thing");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^created: a-new-thing$/mu);
  assert.match(run.stdout, /^name: A new thing$/mu);
});

test("a creation missing either half is refused by name, with nothing sent", async () => {
  state.calls = [];
  const run = await ask("new", "--name", "A new thing");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^project new: a project needs --slug, and nothing was sent/mu);
  assert.equal(state.calls.filter((one) => one.name === "forge_projects.create").length, 0);
});

test("a creation is not a change, so an act beside it is refused", async () => {
  const run = await ask("new", "--name", "n", "--slug", "s", "--archive");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /a project being created is not one being changed/u);
});

test("one field is updated and the fields it takes are named where one is not", async () => {
  const written = await ask("forge-plugin", "--set", "name=The plugin");
  assert.equal(written.status, 0, written.stderr);
  assert.match(written.stdout, /^set: name$/mu);
  assert.match(written.stdout, /^name: The plugin$/mu);

  state.calls = [];
  const wrong = await ask("forge-plugin", "--set", "baseBranch=main");
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /name, description/u, "the fields it does take");
  assert.match(wrong.stderr, /A branch is chosen on the tracker's own settings screen/u);
  assert.equal(state.calls.filter((one) => one.name === "forge_projects.update").length, 0);
});

/* The write announces its own subject: this verb acts on a record the checkout does not scope, so a
   banner naming the checkout's project would name one project while the write went to another. */
test("the write says which project it went to, not which one the checkout is aimed at", async () => {
  const written = await ask("sid-erp", "--set", "name=The product");
  assert.equal(written.status, 0, written.stderr);
  assert.match(written.stderr, /forge_projects -> project sid-erp \(from the call\)/u, written.stderr);
  assert.doesNotMatch(written.stderr, /-> project forge-plugin/u,
    "the checkout's own project is not the subject of an account-level write");
});

test("a pair with no `=` in it is refused rather than read as a field set to nothing", async () => {
  const run = await ask("forge-plugin", "--set", "name");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--set takes one field and its value joined by `=`, not `name`/u);
});

test("the archive is reversible and each direction says which project moved", async () => {
  const away = await ask("forge-plugin", "--archive");
  assert.equal(away.status, 0, away.stderr);
  assert.match(away.stdout, /^archived: forge-plugin$/mu);
  const back = await ask("forge-plugin", "--unarchive");
  assert.equal(back.status, 0, back.stderr);
  assert.match(back.stdout, /^unarchived: forge-plugin$/mu);
});

/* The one act with nothing behind it. The tracker's own route takes the issues, comments,
   attachments and knowledge with the project, and there is no undo, so the flag is hidden and
   refused with the act that replaces it rather than offered in a usage line (ISS-702). */
test("there is no delete, and the refusal names the act that replaces it", async () => {
  state.calls = [];
  const run = await ask("forge-plugin", "--delete");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^project: a project is not deleted from here/mu);
  assert.match(run.stderr, /forge project <slug> --archive/u);
  assert.doesNotMatch(run.stderr, /no project flag named --delete/iu,
    "the unknown-flag route would answer the wrong question about a flag this one refuses");
  assert.equal(state.calls.length, 0, "and nothing was sent");
  const listed = await ask("-h");
  assert.doesNotMatch(listed.stdout, /--delete/u, "a usage row offering it would invite the call");
});

test("two acts on one record are refused rather than one of them silently preferred", async () => {
  const run = await ask("forge-plugin", "--archive", "--unarchive");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--archive and --unarchive are separate acts on one record/u);
});

test("an act naming no project is refused with the usage rather than aimed at the list", async () => {
  state.calls = [];
  const run = await ask("--archive");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--archive acts on one project and none is named/u);
  assert.equal(state.calls.length, 0);
});

test("two projects in one call are refused, one record being what each act takes", async () => {
  const run = await ask("forge-plugin", "sid-erp");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /one project at a time, not `forge-plugin sid-erp`/u);
});
