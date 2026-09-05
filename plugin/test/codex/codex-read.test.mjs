/* The plan and the criteria are the one text a run writes that no commit gate can reach, so the
   verbs ask for themselves. Every case here is planted: the log is this suite's own file, and each
   row is the shape `forge codex consult` writes. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { cleanRepo, tempRoom } from "../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: the log's path is bound when its module loads, and a suite
   that imports first writes to the developer's own log. */
const sandbox = tempRoom("forge-codex-read-");
process.env.XDG_CONFIG_HOME = sandbox;
delete process.env.FORGE_CODEX_DISABLE;

const { digest, locate } = await import("../../src/codex/codex-api.mjs");
const { LOG_PATH, logConsult } = await import("../../src/codex/codex-log.mjs");
const { repoRoot } = await import("../../src/codex/codex.mjs");
const { bodyChecked, readOrRefuse } = await import("../../src/codex/codex-read.mjs");

/* The refusal alone where a case is about the wording, and the pair where it is about the bytes. */
const refusalOf = (...given) => readOrRefuse(...given).refusal;

const PLAN = "# the plan\n\nScreen change: no\n";

/* One checkout, one plan file in it, and the rel the log would key on — read off `locate` rather
   than assembled here, so the test cannot agree with itself against the code. */
const room = () => {
  const root = repoRoot(cleanRepo());
  const path = join(root, "plan.md");
  writeFileSync(path, PLAN);
  return { root, path, rel: locate(root, path).rel };
};

const consulted = (root, rel, text, over = {}) =>
  logConsult({
    kind: "consult",
    id: over.id ?? "aa11bb",
    at: new Date().toISOString(),
    root,
    ok: true,
    reply: "CODEX: 0 findings",
    files: [rel],
    send: "bodies",
    sent: [{ rel, sha: digest(text), chars: text.length, clipped: false }],
    ...over,
  });

test("a plan no consult has read is refused, and the refusal names the consult that clears it", () => {
  const { root, path, rel } = room();
  const refusal = refusalOf(path, root);
  assert.match(refusal, /No consult has read plan\.md/u);
  assert.match(refusal, /forge codex consult --send bodies plan\.md/u);
  assert.match(refusal, /FORGE_CODEX_DISABLE=1/u);
  assert.equal(rel, "plan.md");
});

test("a consult that read the file whole clears the write, and an edit makes it unread again", () => {
  const { root, path, rel } = room();
  consulted(root, rel, PLAN);
  assert.equal(refusalOf(path, root), null);
  writeFileSync(path, `${PLAN}one more line\n`);
  assert.match(refusalOf(path, root), /read plan\.md whole, and its text has changed since/u);
  /* Restored to the bytes that were read: a hash says read where a timestamp would say edited. */
  writeFileSync(path, PLAN);
  assert.equal(refusalOf(path, root), null);
});

test("a diff consult does not clear it, and the refusal names the consult that sent the diff", () => {
  const { root, path, rel } = room();
  consulted(root, rel, PLAN, { id: "d1ff01", send: "diffs" });
  assert.match(refusalOf(path, root), /Consult d1ff01 named plan\.md but sent its diff/u);
});

test("a clipped body and a body that never arrived are both no whole body", () => {
  const clip = room();
  consulted(clip.root, clip.rel, PLAN, { id: "c11p01", sent: [{ rel: clip.rel, sha: digest(PLAN), chars: PLAN.length, clipped: true }] });
  assert.match(refusalOf(clip.path, clip.root), /Consult c11p01 carried no whole body for plan\.md/u);
  const gone = room();
  consulted(gone.root, gone.rel, PLAN, { id: "m1ss01", sent: [{ rel: gone.rel, missing: "ENOENT" }] });
  assert.match(refusalOf(gone.path, gone.root), /Consult m1ss01 carried no whole body for plan\.md/u);
});

test("a consult in another checkout is not this one's", () => {
  const { root, path, rel } = room();
  consulted(join(root, "elsewhere"), rel, PLAN, { id: "0ther1" });
  assert.match(refusalOf(path, root), /No consult has read plan\.md/u);
});

test("one consult naming both files clears both writes", () => {
  const { root, rel } = room();
  const other = join(root, "criteria.md");
  const criteria = "1. it refuses\n";
  writeFileSync(other, criteria);
  const otherRel = locate(root, other).rel;
  logConsult({
    kind: "consult",
    id: "b0th01",
    at: new Date().toISOString(),
    root,
    ok: true,
    reply: "CODEX: 0 findings",
    files: [rel, otherRel],
    send: "bodies",
    sent: [
      { rel, sha: digest(PLAN), chars: PLAN.length, clipped: false },
      { rel: otherRel, sha: digest(criteria), chars: criteria.length, clipped: false },
    ],
  });
  assert.equal(refusalOf(join(root, "plan.md"), root), null);
  assert.equal(refusalOf(other, root), null);
});

test("a body with no file behind it is refused with the file route named", () => {
  const { root } = room();
  for (const path of ["-", "@plan.md"]) {
    assert.match(refusalOf(path, root), /Write it to a file and name the file/u);
  }
});

test("the kill switch stands it down, in this process", () => {
  const { root, path } = room();
  process.env.FORGE_CODEX_DISABLE = "1";
  try {
    assert.equal(refusalOf(path, root), null);
  } finally {
    delete process.env.FORGE_CODEX_DISABLE;
  }
});

/* The one thing a stand-down would cost: the body reader would take the file unjudged. So every
   filesystem answer here is raised, and the caller sees one ENOENT rather than a codex refusal. */
test("a path naming nothing is raised, not stood down into the unchecked reader", () => {
  const { root } = room();
  const gone = join(root, "never-written.md");
  assert.throws(() => readOrRefuse(gone, root), { code: "ENOENT" });
  assert.rejects(bodyChecked(gone, assert.fail, root), { code: "ENOENT" });
});

test("a path naming something that is not a regular file is refused, never read", () => {
  const { root } = room();
  const pipe = join(root, "fifo");
  assert.equal(spawnSync("mkfifo", [pipe]).status, 0);
  assert.match(refusalOf(pipe, root), /is not a regular file/u);
  assert.match(refusalOf(root, root), /is not a regular file/u);
});

/* The verb writes by issue reference from anywhere, so a directory outside every checkout would
   otherwise be the whole way past the rule. */
test("outside every checkout it refuses rather than standing down", () => {
  const nowhere = tempRoom("no-checkout-");
  const path = join(nowhere, "plan.md");
  writeFileSync(path, PLAN);
  assert.match(refusalOf(path, nowhere), /is in no git checkout/u);
});

/* The file's own checkout answers where the caller's directory does not, so a plan named by an
   absolute path from outside is still looked up somewhere. */
test("the file's own checkout is the fallback root", () => {
  const { root, path, rel } = room();
  const nowhere = tempRoom("no-checkout-");
  assert.match(refusalOf(path, nowhere), /No consult has read plan\.md/u);
  consulted(root, rel, PLAN, { id: "fa11ba" });
  assert.equal(refusalOf(path, nowhere), null);
});

/* `bodyFrom` resolves against the directory the caller stood in; `locate` resolves against the
   root. From a subdirectory the two name different files, so the path is resolved first. */
test("a relative path is resolved against the caller's directory, not the root", () => {
  const { root, path } = room();
  const under = join(root, "sub");
  mkdirSync(under);
  const near = join(under, "plan.md");
  writeFileSync(near, "a different plan\n");
  const refusal = refusalOf("plan.md", under);
  assert.match(refusal, /sub\/plan\.md/u);
  assert.doesNotMatch(refusal, /^No consult has read plan\.md/u);
  assert.ok(path !== near);
});

/* A symlink to a regular file outside the root is followed and keyed by where it lands, which is
   the key the consult logged for it. */
test("a symlink out of the checkout is keyed by its real path", () => {
  const { root } = room();
  const outside = tempRoom("outside-");
  const target = join(outside, "plan.md");
  writeFileSync(target, PLAN);
  const link = join(root, "linked.md");
  symlinkSync(target, link);
  const rel = locate(root, link).rel;
  assert.ok(rel.startsWith("/"), `expected an absolute key, got ${rel}`);
  consulted(root, rel, PLAN, { id: "1ink01" });
  assert.equal(refusalOf(link, root), null);
});

test("the log this suite wrote is the sandbox's, never the developer's", () => {
  assert.ok(LOG_PATH.startsWith(sandbox), `${LOG_PATH} is outside ${sandbox}`);
});

/* The caller posts these bytes and never reads again: between a second read and the first sits a
   tracker round trip, and the field would carry the file nobody was shown. */
test("what comes back is the text that was judged, not a promise to read it again", () => {
  const { root, path, rel } = room();
  consulted(root, rel, PLAN, { id: "byte01" });
  assert.deepEqual(readOrRefuse(path, root), { refusal: null, text: PLAN });
  writeFileSync(path, "swapped after the read\n");
  assert.equal(readOrRefuse(path, root).text, null);
});

/* A command a caller pastes has to survive their shell: a name with a space in it became two paths,
   and the consult then read one file and refused on another. */
test("the command the refusal prints is quoted, and names the tree it has to run in", () => {
  const { root } = room();
  const spaced = join(root, "the plan.md");
  writeFileSync(spaced, PLAN);
  assert.match(refusalOf(spaced, root), /--send bodies '(?:the plan\.md)'/u);
  const nowhere = tempRoom("no-checkout-");
  const away = refusalOf(join(root, "plan.md"), nowhere);
  assert.match(away, new RegExp(`cd ${root}( |/)?.*&& echo`, "u"));
  assert.doesNotMatch(refusalOf(join(root, "plan.md"), root), /cd .* &&/u);
});

/* The caller's seat, and the only route through it to a body no consult judged. */
test("bodyChecked answers the judged bytes, raises the refusal, and reads unchecked only when off", async () => {
  const { root, path, rel } = room();
  /* The raise throws, as both callers' do: one that returned would let the read carry on past the
     refusal, and a case counting calls would pass while the body went through. */
  const stop = (why) => {
    throw new Error(`raised: ${why.split("\n")[0]}`);
  };
  await assert.rejects(bodyChecked(path, stop, root), /^Error: raised: No consult has read plan\.md/u);
  consulted(root, rel, PLAN, { id: "seat01" });
  assert.equal(await bodyChecked(path, assert.fail, root), PLAN);
  writeFileSync(path, "never judged\n");
  process.env.FORGE_CODEX_DISABLE = "1";
  try {
    assert.equal(await bodyChecked(path, assert.fail, root), "never judged\n");
  } finally {
    delete process.env.FORGE_CODEX_DISABLE;
  }
});
