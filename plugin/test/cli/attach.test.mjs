/* One name on one issue names one document, whichever verb attached it (ISS-137). ISS-112 carries
   `gate-at-merge.txt` twice because the bare verb sent a file without reading what was up, and there
   is no delete for an upload — so spawned: the refusal has to land before `forge_uploads`. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ISSUE = "33333333-3333-4333-8333-333333333333";
const COMMENT = "44444444-4444-4444-8444-444444444444";

const issue = {
  documentId: ISSUE,
  issueId: "ISS-1",
  status: "in_progress",
  title: "one",
  attachments: [{ name: "gate-at-merge.txt", url: "/api/attachments/one/download" }],
};

/* The lease is the verb's own precondition, so the stub holds the field the claim writes rather than
   answering a stale copy: a get that forgets the update refuses every write as unclaimed. */
let context = null;
const state = { issues: [issue], comments: {}, answer: {} };
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: [issue], returned: 1, hasMore: false };
  if (args.action === "update") {
    if (args.data && "sessionContext" in args.data) context = args.data.sessionContext;
    return { documentId: ISSUE, ...(args.data ?? {}) };
  }
  return { ...issue, sessionContext: context };
};

const tracker = await fakeTracker(state);
after(() => tracker.close());

/* One request per file carries the bytes, so the tracker stub is where they land and this list is
   what arrived: the order the whole set went in is what ISS-577's two cases are about. */
const order = [];
state.answer.forge_uploads = (args) => {
  const name = args?.data?.name ?? "unnamed";
  order.push(`sent ${name}`);
  return { id: `up-${order.length}`, url: "/api/attachments/up/download" };
};
const sunk = () => order.filter((one) => one.startsWith("sent ")).map((one) => one.slice(5));

const room = tempHome("attach-verb");
mkdirSync(join(room.path, "sub"), { recursive: true });
const env = { ...tracker.env, FORGE_SESSION_ID: "attach-session", AI_AGENT: "a-test-agent" };
const ask = (...argv) => ranAsync(FORGE, argv, env);
const asked = () => (state.calls ?? []).filter((one) => one.name === "forge_uploads").length;

const wrote = (name, where = ".") => {
  const path = join(room.path, where === "." ? name : join(where, name));
  writeFileSync(path, `${name}\n`);
  return path;
};

const claimed = await ask("claim", "ISS-1");
assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);

test("a base name already a document on the issue is refused, and nothing is sent", async () => {
  const before = asked();
  const run = await ask("attach", "issue", "ISS-1", wrote("gate-at-merge.txt"));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^gate-at-merge\.txt is already a document on ISS-1/mu, "the document up is named");
  assert.match(run.stderr, /resolves to two documents/u, "and what the collision costs");
  assert.match(run.stderr, /cite it by that name/u, "the first way out");
  assert.match(run.stderr, /under a name of its own/u, "the second");
  assert.equal(asked(), before, "nothing is sent for a name that would resolve two ways");
});

/* A comment's attachments are in the same namespace as the issue's — `attachmentNames` reads both,
   and a verdict citing the name cannot say which document it meant either way. */
test("a base name a comment on the issue carries is the same collision", async () => {
  state.comments[ISSUE] = [{ documentId: COMMENT, body: "one", attachments: [{ name: "shot.png" }] }];
  const before = asked();
  const run = await ask("attach", "issue", "ISS-1", wrote("shot.png"));
  state.comments[ISSUE] = [];
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^shot\.png is already a document on ISS-1/mu);
  assert.equal(asked(), before);
});

test("two paths of one base name in one command are refused before either goes up", async () => {
  const before = asked();
  const run = await ask("attach", "issue", "ISS-1", wrote("twice.txt"), wrote("twice.txt", "sub"));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /is named twice in this command/u);
  assert.equal(asked(), before, "the paths are read whole before the first request");
});

test("a base name on none of the issue's documents is sent as before", async () => {
  const run = await ask("attach", "issue", "ISS-1", wrote("gate-at-27f1f70.txt"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^gate-at-27f1f70\.txt {2}\/api\/attachments\/up\/download$/mu);
  assert.ok(sunk().includes("gate-at-27f1f70.txt"), `sent ${sunk().join(", ")}`);
});

/* Where the walk cannot reach the end the names cannot be read whole — and unlike `record
   --evidence`, which can cite a URL and send nothing, a refusal here is one nothing the caller could
   type would clear. So it is said, in the count the tracker returned (ISS-131), and sent. */
test("a thread the walk could not finish is said on stderr, and the file still goes up", async () => {
  state.answer.forge_comments = (args) =>
    (args.action === "list"
      ? { comments: [{ documentId: COMMENT, body: "one of many", attachments: [] }], returned: 1, hasMore: true }
      : { documentId: COMMENT });
  /* The first call is spent on the read-before-write hold, which the page's own comment earns. */
  await ask("attach", "issue", "ISS-1", wrote("cut-page.txt"));
  const run = await ask("attach", "issue", "ISS-1", wrote("cut-page.txt"));
  delete state.answer.forge_comments;
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /^The names already on ISS-1 cannot be read whole\./mu);
  assert.match(run.stderr, /stopped after 1 comment\(s\) of 1 without the tracker ever calling the read complete/u,
    "the count the tracker returned, and no cap of ours (ISS-131)");
  assert.match(run.stderr, /resolves to two documents/u, "what the unread names could cost");
  assert.ok(sunk().includes("cut-page.txt"), `sent ${sunk().join(", ")}`);
});

/* A comment id names no issue and the tracker offers no route from one to the other, so this route
   reads no names — the same reason it renews no lease. */
test("a comment target reads no names and is refused for no collision", async () => {
  const run = await ask("attach", "comment", COMMENT, wrote("gate-at-merge.txt", "sub"));
  assert.equal(run.status, 0, run.stderr);
  assert.ok(sunk().includes("gate-at-merge.txt"), `sent ${sunk().join(", ")}`);
});

/* Nothing precedes the request carrying the bytes: a pre-flight added back is what fails here. */
test("each file goes up in one request of its own, and nothing is sent for it first", async () => {
  order.length = 0;
  const run = await ask("attach", "issue", "ISS-1", wrote("first-of-two.txt"), wrote("second-of-two.txt"));
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(order, ["sent first-of-two.txt", "sent second-of-two.txt"],
    "two files, two requests, in the order they were named");
});

/* One request cannot ask before it sends, so a name the tracker will not take costs that file's own
   request and leaves the ones before it up, undeletable: the refusal owes which, and what to cite. */
test("a name refused mid-write names the files already up and how to cite them", async () => {
  order.length = 0;
  const own = state.answer.forge_uploads;
  state.answer.forge_uploads = (args) => {
    if (!args?.data?.name?.endsWith(".log")) return own(args);
    order.push(`sent ${args.data.name}`);
    return { refused: "mime not allowed: application/octet-stream", code: "MIME_NOT_ALLOWED" };
  };
  const run = await ask("attach", "issue", "ISS-1", wrote("up-before-it.txt"), wrote("refused-here.log"));
  state.answer.forge_uploads = own;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^refused-here\.log is a name the tracker would not take/mu);
  assert.match(run.stderr, /MIME_NOT_ALLOWED/u, "in the tracker's own line");
  assert.match(run.stderr, /1 file\(s\) of this write are up and cannot be deleted: up-before-it\.txt\./u);
  assert.match(run.stderr, /--evidence up-before-it\.txt/u, "and the citation to make instead of the path");
  assert.deepEqual(order, ["sent up-before-it.txt", "sent refused-here.log"]);
});

/* What a write puts up is what it scanned, and between the two passes the digest is what says so. */
test("a file rewritten between the scan and its request is refused, and no bytes follow", async () => {
  const first = wrote("scanned-first.txt");
  const path = wrote("swapped-after-scan.txt");
  order.length = 0;
  const own = state.answer.forge_uploads;
  /* The rewrite rides the request before it, that being the window the digest covers. */
  state.answer.forge_uploads = (args) => {
    if (args?.data?.name === "scanned-first.txt") writeFileSync(path, "credential-bearing bytes\n");
    return own(args);
  };
  const run = await ask("attach", "issue", "ISS-1", first, path);
  state.answer.forge_uploads = own;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /changed on disk between the scan that cleared it and its upload/u);
  assert.deepEqual(order, ["sent scanned-first.txt"], "the one before it went and nothing followed");
});

/* The scan is the write's other refusal, and its ordering is ISS-577's where the refusal is not. */
test("a credential in the last file is refused before the first of them is sent", async () => {
  const secret = "staging-password-nobody-should-attach";
  state.answer["forge_projects.get"] = () => ({ project: { previewDeploy: { url: "https://staging.test", password: secret } } });
  order.length = 0;
  const clean = wrote("scan-first.txt");
  const leaky = join(room.path, "scan-second.txt");
  writeFileSync(leaky, `the deploy takes ${secret}\n`);
  const run = await ask("attach", "issue", "ISS-1", clean, leaky);
  delete state.answer["forge_projects.get"];
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /carries this project's/u, "the leak is named");
  assert.deepEqual(order, [], "and the file before it was never sent, its request never made");
});
