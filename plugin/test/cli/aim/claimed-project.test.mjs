/* A run's claim holds the project it was taken in: once the saved slug moves under the run, its own
   key resolving to another project's issue is refused rather than followed (ISS-2452,
   docs/cli/one-call-elsewhere.md). Two projects hold one key, ISS-7, with different rows and threads,
   and the checkout's record is moved between them the way a sibling's `forge doctor --set slug=` does. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ranAsync, tempRoom } from "../../fixtures.mjs";
import { projectRecord, projectRoom } from "../../fixtures/rooms/lifecycle.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const OWN_ID = "0a0a0a0a-0000-4000-8000-000000000001";
const FAR_ID = "0b0b0b0b-0000-4000-8000-000000000002";
const FAR = "far-away";
const OWN_SEVEN = "0a0a0a0a-0000-4000-8000-000000000007";
const FAR_SEVEN = "0b0b0b0b-0000-4000-8000-000000000007";

const rowOn = (documentId, number, title) => ({
  issueId: `ISS-${number}`, documentId, status: "open", priority: "medium", title, complexity: "s",
  createdAt: `2026-09-0${number}T00:00:00.000Z`,
});
const ROWS = {
  [OWN_ID]: [rowOn(`${OWN_ID.slice(0, 8)}-own-1`, 1, "own one"), rowOn(`${OWN_ID.slice(0, 8)}-own-3`, 3, "own three"),
    rowOn(OWN_SEVEN, 7, "the checkout's own seventh")],
  [FAR_ID]: [rowOn(`${FAR_ID.slice(0, 8)}-far-1`, 1, "far one"), rowOn(`${FAR_ID.slice(0, 8)}-far-3`, 3, "far three"),
    rowOn(FAR_SEVEN, 7, "the far project's seventh")],
};
const everyRow = () => [...ROWS[OWN_ID], ...ROWS[FAR_ID]];

const state = {
  calls: [],
  comments: {},
  answer: {
    "forge_projects.list": () => ({ projects: [{ id: OWN_ID, slug: OWN.slug }, { id: FAR_ID, slug: FAR }] }),
    forge_issues: (args) => {
      if (args.action === "list") {
        const slug = state.calls.at(-1)?.slug;
        const rows = ROWS[args.project ?? (slug === FAR ? FAR_ID : OWN_ID)] ?? [];
        return { issues: rows, returned: rows.length, hasMore: false };
      }
      const row = everyRow().find((one) => one.documentId === args.documentId);
      if (!row) return {};
      if (args.action === "update" && !(state.dropped ?? []).includes(row.documentId)) Object.assign(row, args.data ?? {});
      return row;
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

const { tracker, env: base } = await trackerFor(state);
test.after(() => tracker.close());
const home = base.XDG_CONFIG_HOME;
const room = projectRoom(tempRoom("claimed-project-"), home, OWN);
const as = (holder) => (argv) => ranAsync(FORGE, argv, { ...base, FORGE_SESSION_ID: holder }, room);
const run = as("claimed-project-run");
const moveSlug = (slug) => projectRecord(room, home, { ...OWN, slug });

const bodyFile = (text) => {
  const path = join(tempRoom("claimed-project-body-"), "body.md");
  writeFileSync(path, `${text}\n`);
  return path;
};

const posts = () => state.calls.filter((one) => one.method === "POST" || one.method === "PATCH");

test("a key claimed on one project is refused on the project the saved slug moved to, and nothing is sent", async () => {
  moveSlug(OWN.slug);
  const claimed = await run(["claim", "ISS-7"]);
  assert.equal(claimed.status, 0, claimed.stderr);
  assert.equal(ROWS[OWN_ID][2].sessionContext?.lease?.holder, "claimed-project-run", "the claim landed on the own row");

  /* Another holder writes its own pins between the claim and the move, which must not touch these. */
  const other = as("another-holder");
  const otherClaim = await other(["claim", "ISS-1"]);
  assert.equal(otherClaim.status, 0, otherClaim.stderr);

  moveSlug(FAR);
  for (const argv of [["issue", "ISS-7"], ["claim", "ISS-7"], ["comment", "ISS-7", bodyFile("a stray finding")]]) {
    state.calls = [];
    const refused = await run(argv);
    assert.equal(refused.status, 1, argv.join(" "));
    assert.match(refused.stderr, new RegExp(`ISS-7 resolves in project ${FAR} \\(from [^)]*config\\.json\\) to document ${FAR_SEVEN}`, "u"),
      `${argv[0]} names the project and document the key resolves to now, and the file that chose it`);
    assert.match(refused.stderr, new RegExp(`this run claimed ISS-7 on project ${OWN.slug}, document ${OWN_SEVEN}`, "u"),
      `${argv[0]} names the project and document the claim was taken on`);
    assert.match(refused.stderr, new RegExp(`forge doctor --set slug=${OWN.slug}`, "u"), `${argv[0]} names the way back`);
    assert.deepEqual(posts(), [], `${argv[0]} sent no write`);
  }
  assert.equal(state.comments[FAR_SEVEN], undefined, "nothing was posted on the far issue");
  assert.equal(state.comments[OWN_SEVEN], undefined, "nor on the own one");
  assert.equal(ROWS[FAR_ID][2].sessionContext, undefined, "and no lease was taken on the far issue");
});

test("a call aimed at the other project reads its issue under the same key, and the claim still holds", async () => {
  moveSlug(FAR);
  const aimed = await run(["issue", "ISS-7", "--project", FAR]);
  assert.equal(aimed.status, 0, aimed.stderr);
  assert.equal(JSON.parse(aimed.stdout).documentId, FAR_SEVEN);

  const unaimed = await run(["issue", "ISS-7"]);
  assert.equal(unaimed.status, 1, "the aimed read left the pin where the claim put it");
});

test("a holder that claimed nothing resolves the moved key with no refusal", async () => {
  moveSlug(FAR);
  const read = await as("a-fresh-holder")(["issue", "ISS-7"]);
  assert.equal(read.status, 0, read.stderr);
  assert.equal(JSON.parse(read.stdout).documentId, FAR_SEVEN);
});

test("a claim by the other project's document id moves the run's claim there", async () => {
  moveSlug(FAR);
  const moved = await run(["claim", FAR_SEVEN]);
  assert.equal(moved.status, 0, moved.stderr);
  const read = await run(["issue", "ISS-7"]);
  assert.equal(read.status, 0, read.stderr);
  assert.equal(JSON.parse(read.stdout).documentId, FAR_SEVEN, "the key now resolves where the claim was moved");
  moveSlug(OWN.slug);
});

test("a claim whose lease did not read back as written holds the key to nothing", async () => {
  moveSlug(OWN.slug);
  const holder = as("a-dropped-claim");
  state.dropped = [ROWS[OWN_ID][1].documentId];
  const dropped = await holder(["claim", "ISS-3"]);
  state.dropped = [];
  assert.equal(dropped.status, 1, "the tracker took the update and kept the field as it was");
  assert.match(dropped.stderr, /did not read back as written/u, "and the claim was refused for that, not for a lease already there");
  moveSlug(FAR);
  const read = await holder(["issue", "ISS-3"]);
  assert.equal(read.status, 0, read.stderr);
  assert.equal(JSON.parse(read.stdout).documentId, ROWS[FAR_ID][1].documentId, "no pin was left by the claim that did not land");
  moveSlug(OWN.slug);
});
