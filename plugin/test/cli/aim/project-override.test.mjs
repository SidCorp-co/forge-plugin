/* One call aimed at another project with `--project`, and nothing after it: the aim reaches the
   tracker under the named project, and no record this machine keeps of any project moves
   (docs/cli/one-call-elsewhere.md). Two projects hold one key, ISS-7, with different rows and
   threads, which is the shape that tells a call reaching the right one from one reaching the other. */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ranAsync, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const OWN_ID = "0a0a0a0a-0000-4000-8000-000000000001";
const FAR_ID = "0b0b0b0b-0000-4000-8000-000000000002";
const FAR = "far-away";

const rowOn = (where, number, title) => ({
  issueId: `ISS-${number}`, documentId: `${where}-${number}`, status: "open", priority: "medium", title,
  createdAt: `2026-09-0${number}T00:00:00.000Z`,
});
const ROWS = {
  [OWN_ID]: [rowOn("own", 1, "own one"), rowOn("own", 7, "the checkout's own seventh")],
  [FAR_ID]: [rowOn("far", 1, "far one"), rowOn("far", 7, "the far project's seventh")],
};
const everyRow = () => [...ROWS[OWN_ID], ...ROWS[FAR_ID]];

const state = {
  calls: [],
  comments: {},
  answer: {
    "forge_projects.list": () => ({ projects: [{ id: OWN_ID, slug: OWN.slug }, { id: FAR_ID, slug: FAR }] }),
    forge_issues: (args) => {
      if (args.action === "list") {
        /* The search route addresses its project in the path and hands the handler no id, so the
           project is read off the call the fixture has just recorded. */
        const slug = state.calls.at(-1)?.slug;
        const rows = ROWS[args.project ?? (slug === FAR ? FAR_ID : OWN_ID)] ?? [];
        const wanted = String(args.filters?.search ?? "").toLowerCase();
        const held = wanted ? rows.filter((one) => one.title.toLowerCase().includes(wanted)) : rows;
        return { issues: held, returned: held.length, hasMore: false };
      }
      return everyRow().find((one) => one.documentId === args.documentId) ?? {};
    },
    forge_comments: (args) => {
      if (args.action === "list") {
        const rows = state.comments[args.filters.issue] ?? [];
        return { comments: rows, returned: rows.length, limit: rows.length, hasMore: false };
      }
      const row = { documentId: `c-${Object.keys(state.comments).length + 1}`, ...args.data };
      state.comments[args.data.issue] = [...(state.comments[args.data.issue] ?? []), row];
      return row;
    },
  },
};

const { tracker, env: base, room } = await trackerFor(state);
test.after(() => tracker.close());
const env = { ...base, FORGE_SESSION_ID: "project-override-run" };
const ran = (argv) => ranAsync(FORGE, argv, env, room);

/* Every byte of every project record this machine keeps, keyed by path. */
const recordsDir = join(base.XDG_CONFIG_HOME, "forge", "projects");
const recordsNow = () => {
  const held = {};
  const walk = (at) => {
    for (const name of readdirSync(at)) {
      const path = join(at, name);
      if (statSync(path).isDirectory()) walk(path);
      else held[path] = readFileSync(path, "utf8");
    }
  };
  walk(recordsDir);
  return held;
};

const bodyFile = (text) => {
  const path = join(tempRoom("project-override-"), "body.md");
  writeFileSync(path, `${text}\n`);
  return path;
};

const projectsAsked = () => [...new Set(state.calls.map((one) => one.slug).filter(Boolean))];

test("a read and a comment naming another project reach it and leave every saved record as it was", async () => {
  const before = recordsNow();
  assert.ok(Object.keys(before).length, "the checkout's own record is there to be compared");
  state.calls = [];

  const read = await ran(["issue", "ISS-7", "--project", FAR]);
  assert.equal(read.status, 0, read.stderr);
  const row = JSON.parse(read.stdout);
  assert.equal(row.documentId, "far-7", "the key was resolved on the named project");
  assert.equal(row.project, FAR, "and the read says which project that was");
  assert.deepEqual(projectsAsked(), [FAR], "every project-scoped call went to the named project");
  assert.match(read.stderr, /aimed at project far-away for this call alone/u);

  const projected = await ran(["issue", "ISS-7", "--project", FAR, "--fields", "status"]);
  assert.equal(projected.status, 0, projected.stderr);
  assert.deepEqual(JSON.parse(projected.stdout), { documentId: "far-7", issueId: "ISS-7", project: FAR, status: "open" },
    "the projection a program keys on carries the project beside the two identifiers");

  const searched = await ran(["issue", "--project", FAR, "--search", "seventh"]);
  assert.equal(searched.status, 0, searched.stderr);
  assert.match(searched.stdout, /the far project's seventh/u);
  assert.doesNotMatch(searched.stdout, /the checkout's own seventh/u, "and the listing is the named project's");

  state.comments["far-7"] = [{ documentId: "c-far", body: "the far thread", createdAt: "2026-09-02T00:00:00.000Z" }];
  const thread = await ran(["comment", "--project", FAR, "ISS-7"]);
  assert.equal(thread.status, 0, thread.stderr);
  assert.match(thread.stdout, /^ISS-7: 1 comment\(s\), on project far-away/mu, "the heading names the project");
  assert.match(thread.stdout, /the far thread/u);

  const posted = await ran(["comment", "ISS-7", bodyFile("a finding for the far row"), "--project", FAR]);
  assert.equal(posted.status, 0, posted.stderr);
  assert.ok(state.comments["far-7"].some((one) => /a finding for the far row/u.test(one.body)),
    "the comment landed on the named project's issue");
  assert.equal(state.comments["own-7"], undefined, "and nothing reached the checkout's own ISS-7");
  assert.match(posted.stdout, /No lease on ISS-7 is yours/u, "a post aimed elsewhere takes no lease");

  assert.deepEqual(recordsNow(), before, "no record this machine keeps of any project moved");

  state.calls = [];
  const home = await ran(["issue", "ISS-7"]);
  assert.equal(home.status, 0, home.stderr);
  assert.equal(JSON.parse(home.stdout).documentId, "own-7", "the next call without the flag is the checkout's own");
  assert.equal(JSON.parse(home.stdout).project, OWN.slug);
  assert.deepEqual(projectsAsked(), [OWN.slug]);
});

test("a key the aimed project does not hold is refused naming that project", async () => {
  const aimed = await ran(["issue", "ISS-9", "--project", FAR]);
  assert.equal(aimed.status, 1);
  assert.match(aimed.stderr, /ISS-9 is not on the tracker of project far-away \(from --project on this call\)/u);
  assert.match(aimed.stderr, /`forge issue --project far-away`/u, "and the route to its keys keeps the aim");

  const own = await ran(["issue", "ISS-9"]);
  assert.equal(own.status, 1);
  assert.match(own.stderr, new RegExp(`ISS-9 is not on the tracker of project ${OWN.slug} \\(from [^)]*config\\.json\\)`, "u"),
    "the checkout's own project is named with the record it came from");
  assert.match(own.stderr, /forge issue ISS-9 --project <slug>/u, "beside the route to another project");
});

test("a slug the credential cannot see is refused naming --project, and nothing is posted", async () => {
  state.calls = [];
  const run = await ran(["comment", "ISS-7", bodyFile("never sent"), "--project", "nobody-has-this"]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No Forge project this credential can see has slug nobody-has-this, which --project on this call names/u);
  assert.ok(!state.calls.some((one) => one.method === "POST"), "no comment was sent anywhere");
});

test("--project twice, or with no value, is refused before any request", async () => {
  state.calls = [];
  const twice = await ran(["issue", "ISS-7", "--project", FAR, "--project", OWN.slug]);
  assert.equal(twice.status, 1);
  assert.match(twice.stderr, /--project was given twice/u);
  const bare = await ran(["comment", "ISS-7", "--project"]);
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, /--project was given no value/u);
  assert.deepEqual(state.calls, [], "neither call reached the tracker");
});

test("an issue write beside --project is refused with nothing sent", async () => {
  for (const write of [["--set", "priority=low", "--why", "x"], ["--blocks", "ISS-1"], ["--redact"], ["--propose"]]) {
    state.calls = [];
    const run = await ran(["issue", "ISS-7", "--project", FAR, ...write]);
    assert.equal(run.status, 1, write.join(" "));
    assert.match(run.stderr, /--project aims a read at another project/u, write.join(" "));
    assert.deepEqual(state.calls, [], `${write[0]} sent nothing`);
  }
});

test("issue and comment each list --project in their help", async () => {
  for (const verb of ["issue", "comment"]) {
    const run = await ran([verb, "-h"]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /\[--project <slug>\]/u, verb);
  }
});

test("a listing's next page carries the aim it was read under", async () => {
  const run = await ran(["issue", "--project", FAR, "--limit", "1"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /forge issue --limit 1 --project far-away --offset 1/u);
});
