/* One name on one issue names one document, whichever verb attached it (ISS-137). ISS-112 carries
   `gate-at-merge.txt` twice because the bare verb minted a slot without reading what was up, and
   there is no delete for an upload — so spawned: the refusal has to land before `forge_uploads`. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "node:http";
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

/* The bytes have to land somewhere for the sending half to be judged: the tracker stub reads every
   request as json, and a PUT of a text file is not one. */
const sunk = [];
/* Mints and PUTs in one list, because which came before which is the whole of ISS-577. */
const order = [];
const sink = createServer((request, response) => {
  sunk.push(request.url);
  order.push(`put ${request.url}`);
  request.resume();
  request.on("end", () => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ id: "up", name: "n", url: "/api/attachments/up/download" }));
  });
});
await new Promise((ready) => sink.listen(0, "127.0.0.1", ready));
after(() => sink.close());
state.answer.forge_uploads = (args) => {
  order.push(`mint ${args?.data?.name ?? "unnamed"}`);
  return { uploadUrl: `http://127.0.0.1:${sink.address().port}/put/${args?.data?.name ?? "unnamed"}` };
};

const room = tempHome("attach-verb");
mkdirSync(join(room.path, "sub"), { recursive: true });
const env = { ...tracker.env, FORGE_SESSION_ID: "attach-session", AI_AGENT: "a-test-agent" };
const ask = (...argv) => ranAsync(FORGE, argv, env);
const minted = () => (state.calls ?? []).filter((one) => one.name === "forge_uploads").length;

const wrote = (name, where = ".") => {
  const path = join(room.path, where === "." ? name : join(where, name));
  writeFileSync(path, `${name}\n`);
  return path;
};

const claimed = await ask("claim", "ISS-1");
assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);

test("a base name already a document on the issue is refused, and nothing is sent", async () => {
  const before = minted();
  const run = await ask("attach", "issue", "ISS-1", wrote("gate-at-merge.txt"));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^gate-at-merge\.txt is already a document on ISS-1/mu, "the document up is named");
  assert.match(run.stderr, /resolves to two documents/u, "and what the collision costs");
  assert.match(run.stderr, /cite it by that name/u, "the first way out");
  assert.match(run.stderr, /under a name of its own/u, "the second");
  assert.equal(minted(), before, "no slot is minted for a name that would resolve two ways");
});

/* A comment's attachments are in the same namespace as the issue's — `attachmentNames` reads both,
   and a verdict citing the name cannot say which document it meant either way. */
test("a base name a comment on the issue carries is the same collision", async () => {
  state.comments[ISSUE] = [{ documentId: COMMENT, body: "one", attachments: [{ name: "shot.png" }] }];
  const before = minted();
  const run = await ask("attach", "issue", "ISS-1", wrote("shot.png"));
  state.comments[ISSUE] = [];
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^shot\.png is already a document on ISS-1/mu);
  assert.equal(minted(), before);
});

test("two paths of one base name in one command are refused before either goes up", async () => {
  const before = minted();
  const run = await ask("attach", "issue", "ISS-1", wrote("twice.txt"), wrote("twice.txt", "sub"));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /is named twice in this command/u);
  assert.equal(minted(), before, "the paths are read whole before the first PUT");
});

test("a base name on none of the issue's documents is sent as before", async () => {
  const run = await ask("attach", "issue", "ISS-1", wrote("gate-at-27f1f70.txt"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^gate-at-27f1f70\.txt {2}\/api\/attachments\/up\/download$/mu);
  assert.ok(sunk.some((one) => one.endsWith("/put/gate-at-27f1f70.txt")), `sank ${sunk.join(", ")}`);
});

/* The list takes no cursor, so past its cut the names cannot be read whole — and unlike `record
   --evidence`, which can cite a URL and send nothing, a refusal here is one nothing the caller could
   type would clear. So it is said, in the count the tracker returned (ISS-131), and sent. */
test("a comment page the tracker cut is said on stderr, and the file still goes up", async () => {
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
  assert.match(run.stderr, /returned 1 comment\(s\) and reported more behind them, for a reason it did not name/u,
    "the count the tracker returned, and no cap of ours (ISS-131)");
  assert.match(run.stderr, /resolves to two documents/u, "what the unread names could cost");
  assert.ok(sunk.some((one) => one.endsWith("/put/cut-page.txt")), `sank ${sunk.join(", ")}`);
});

/* A comment id names no issue and the tracker offers no route from one to the other, so this route
   reads no names — the same reason it renews no lease. */
test("a comment target reads no names and is refused for no collision", async () => {
  const run = await ask("attach", "comment", COMMENT, wrote("gate-at-merge.txt", "sub"));
  assert.equal(run.status, 0, run.stderr);
  assert.ok(sunk.some((one) => one.endsWith("/put/gate-at-merge.txt")), `sank ${sunk.join(", ")}`);
});

/* The tracker refuses a name it cannot type at the mint, so every slot is taken before any bytes
   go and a refusal costs no attachment (ISS-577). */
test("every slot on a write is minted before any of the bytes go", async () => {
  order.length = 0;
  const run = await ask("attach", "issue", "ISS-1", wrote("first-of-two.txt"), wrote("second-of-two.txt"));
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(order, [
    "mint first-of-two.txt",
    "mint second-of-two.txt",
    "put /put/first-of-two.txt",
    "put /put/second-of-two.txt",
  ], "both mints, then both PUTs");
});

/* What a write puts up is what it scanned, and between the two passes the digest is what says so. */
test("a file rewritten between the scan and its upload is refused, and no bytes follow", async () => {
  const path = wrote("swapped-after-scan.txt");
  order.length = 0;
  const own = state.answer.forge_uploads;
  state.answer.forge_uploads = (args) => {
    if (args?.data?.name === "swapped-after-scan.txt") writeFileSync(path, "credential-bearing bytes\n");
    return own(args);
  };
  const run = await ask("attach", "issue", "ISS-1", path);
  state.answer.forge_uploads = own;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /changed on disk between the scan that cleared it and its upload/u);
  assert.deepEqual(order, ["mint swapped-after-scan.txt"], "the slot was taken and nothing followed it");
});

/* The scan is the write's other refusal, and its ordering is ISS-577's where the refusal is not. */
test("a credential in the last file is refused before the first of them is minted", async () => {
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
  assert.deepEqual(order, [], "and the file before it was never minted, let alone sent");
});
