/* `forge baseline publish` in a project that is not this repository: a checkout of its own with a
   bare remote behind it and a slug this checkout never carries, so the whole route an adopting
   project takes — declare a gate, publish at the head it pushed, cite it from a branch cut there —
   is driven end to end through the shipped binary. Every refusal is read against the store as well
   as the exit, because a refusal that wrote first is a green from nowhere with an error beside it. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { projectRecord, ranAsync, tempRoom } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ADOPTER = "a-project-that-adopted-the-plugin";
const CITING = `${ADOPTER}-citing`;
const GATES = ["make check", "make test"];
const RESULT = "nothing fails: every target green";

const ISSUE = {
  documentId: "adopter-uuid",
  issueId: "ISS-5",
  status: "approved",
  title: "an issue in the adopting project",
  description: "no mark here",
  complexity: "m",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
};
const state = { calls: [], issues: [ISSUE], comments: { "adopter-uuid": [] }, answer: {} };
/* The adopting project is one the tracker serves beside this one, so a call from its checkout resolves it. */
state.answer["forge_projects.list"] = () => ({ projects: [
  { id: "1e1c1a1e-0000-4000-8000-0000000000ff", slug: "forge-plugin" },
  { id: "1e1c1a1e-0000-4000-8000-0000000017a0", slug: CITING },
] });
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
  if (args.action === "get") return ISSUE;
  if (args.action === "update") return Object.assign(ISSUE, args.data);
  return { documentId: args.documentId, ...(args.data ?? {}) };
};
state.answer.forge_comments = (args) => {
  if (args.action === "list") return { comments: state.comments["adopter-uuid"], returned: 0, hasMore: false };
  return { documentId: `posted-${state.calls.length}`, createdAt: "2026-09-24T10:00:00.000Z", body: args.body };
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
const HOME = ENV.XDG_CONFIG_HOME;
const env = { ...ENV, FORGE_SESSION_ID: "the-adopting-run" };

/* The store this process reads is the one the children write: one file per configuration home. */
process.env.XDG_CONFIG_HOME = HOME;
const { publishedPath } = await import("../../../src/flow/earned/published.mjs");
const { remoteDefaultHead } = await import("../../../src/flow/earned/publish.mjs");

const stored = () => (existsSync(publishedPath())
  ? readFileSync(publishedPath(), "utf8").trim().split("\n").filter(Boolean).map((one) => JSON.parse(one))
  : []);

const repo = (keys = { slug: ADOPTER, stats: { commands: { gate: GATES } } }) => {
  const room = tempRoom("adopter-");
  const bare = tempRoom("adopter-remote-");
  const as = (...args) => spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args],
    { cwd: room, encoding: "utf8" });
  spawnSync("git", ["init", "-q", "--bare", "-b", "master", bare], { cwd: dirname(bare), encoding: "utf8" });
  spawnSync("git", ["init", "-q", "-b", "master", room], { cwd: dirname(room), encoding: "utf8" });
  projectRecord(room, HOME, keys);
  /* The room's own name in the tree: two repositories committed in one second with the same content are one commit, and a store keyed on the commit would read the second as the first. */
  writeFileSync(join(room, "Makefile"), `check:\n\ttrue\n# ${room}\n`);
  as("add", ".");
  as("commit", "-qm", "base");
  as("remote", "add", "origin", bare);
  as("push", "-q", "origin", "HEAD:master");
  return { room, as, at: as("rev-parse", "HEAD").stdout.trim() };
};

const publishing = (room, commit, extra = []) => ranAsync(FORGE,
  ["baseline", "publish", "--commit", commit, "--result", RESULT, "--scope", "whole", ...extra], env, room);

test("the remote's default branch is read off its own HEAD, and an answer naming none is null", () => {
  const sha = "a".repeat(40);
  assert.equal(remoteDefaultHead(() => `ref: refs/heads/trunk\tHEAD\n${sha}\tHEAD`), sha,
    "a default branch of any name is the one the remote names");
  assert.equal(remoteDefaultHead(() => null), null, "a remote that did not answer names no commit");
  assert.equal(remoteDefaultHead(() => `${sha}\trefs/heads/master`), null, "and a branch line is not HEAD");
});

test("a scope short of whole, a dirty tree and a commit the remote does not hold each publish nothing", async () => {
  const { room, as, at } = repo();
  const before = stored().length;
  const part = await ranAsync(FORGE, ["baseline", "publish", "--commit", at, "--result", RESULT,
    "--scope", "part"], env, room);
  assert.equal(part.status, 1, part.stdout);
  assert.match(part.stderr, /--scope `part` is not `whole`/u, "the scope is refused by name");
  writeFileSync(join(room, "stray.txt"), "uncommitted\n");
  const dirty = await publishing(room, at);
  assert.equal(dirty.status, 1, dirty.stdout);
  assert.match(dirty.stderr, /holds uncommitted work/u, "a tree the commit does not name is refused");
  as("add", "stray.txt");
  as("commit", "-qm", "a run's own commit, never pushed");
  const own = as("rev-parse", "HEAD").stdout.trim();
  const unpushed = await publishing(room, own);
  assert.equal(unpushed.status, 1, unpushed.stdout);
  assert.match(unpushed.stderr, /default branch holds \w{7} and this checkout is at \w{7}/u,
    "the refusal names both heads");
  const elsewhere = await publishing(room, at);
  assert.equal(elsewhere.status, 1, elsewhere.stdout);
  assert.match(elsewhere.stderr, /is not the commit this checkout stands at/u, "a commit other than the head is refused");
  assert.equal(stored().length, before, "and not one of the four wrote to the store");
});

test("a gate the project does not declare is refused, and none named publishes the first it declares", async () => {
  const { room, at } = repo();
  const wrong = await publishing(room, at, ["--gate", "npm test"]);
  assert.equal(wrong.status, 1, wrong.stdout);
  assert.match(wrong.stderr, /`npm test` is none of the gate commands this project declares \(`make check`, `make test`\)/u);
  assert.equal(stored().some((one) => one.commit === at), false, "nothing was written for that head");
  const named = await publishing(room, at, ["--gate", "make test", "--version", "2.0.0"]);
  assert.equal(named.status, 0, named.stdout + named.stderr);
  assert.equal(stored().findLast((one) => one.commit === at).gate, "make test", "a declared gate named is the one kept");
  const other = repo();
  const bare = await publishing(other.room, other.at);
  assert.equal(bare.status, 0, bare.stdout + bare.stderr);
  assert.equal(stored().findLast((one) => one.commit === other.at).gate, "make check",
    "with no --gate the first declared command is the result's gate");
});

test("a project that declares no gate is told to name one or declare it, and nothing is published", async () => {
  const { room, at } = repo({ slug: `${ADOPTER}-undeclared` });
  const asked = await publishing(room, at);
  assert.equal(asked.status, 1, asked.stdout);
  assert.match(asked.stderr, /declares none under `stats\.commands\.gate`/u);
  assert.match(asked.stderr, /forge doctor --set stats\.commands\.gate=/u, "with the declaration that ends it");
  assert.equal(stored().some((one) => one.commit === at), false);
});

test("a project other than this one publishes at the head it pushed, and a branch cut there cites it", async () => {
  const { room, at } = repo({ slug: CITING, stats: { commands: { gate: GATES } } });
  const owed = await ranAsync(FORGE, ["advance", "ISS-5", "--owed"], env, room);
  assert.equal(owed.status, 0, owed.stdout + owed.stderr);
  assert.match(owed.stdout, /Nothing has ever/u,
    "a project nothing ever published for is told the route is closed, not merely empty");
  assert.match(owed.stdout, /forge record baseline ISS-5 --gate "make check" --result/u,
    "and the fresh form arrives with the declared gate filled in");
  assert.ok(await ranAsync(FORGE, ["claim", "ISS-5"], env, room), "the lease a payload write needs");
  const citing = () => ranAsync(FORGE, ["record", "baseline", "ISS-5", "--gate", "make check", "--result", RESULT,
    "--commit", at, "--scope", "whole", "--cited", "the release's gate at 3.1.0"], env, room);
  const early = await citing();
  assert.equal(early.status, 1, "before the publish the citation is a green from nowhere");
  const published = await publishing(room, at, ["--version", "3.1.0"]);
  assert.equal(published.status, 0, published.stdout + published.stderr);
  assert.match(published.stdout, /readable on this machine only/u, "the publish says whose store it is in");
  const wrote = stored().findLast((one) => one.commit === at);
  assert.deepEqual([wrote.project, wrote.scope, wrote.gate, wrote.result, wrote.version],
    [CITING, "whole", "make check", RESULT, "3.1.0"], "filed under the adopting project's own slug");
  const cited = await ranAsync(FORGE, ["advance", "ISS-5", "--owed"], env, room);
  assert.ok(cited.stdout.includes(`--commit ${at} --scope whole --cited "the ship's gate at release 3.1.0"`),
    "the rehearsal now offers the citation");
  const taken = await citing();
  assert.equal(taken.status, 0, taken.stdout + taken.stderr);
  assert.ok(taken.stdout.includes(`commit: ${at}`), "and the citing write goes up carrying that commit");
});
