/* The plan and the criteria are the one text a run writes that no commit gate can reach, so the
   verbs ask for themselves. Every case here is planted: the log is this suite's own file, and each
   row is the shape `forge codex consult` writes. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, writeFileSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { cleanRepo, escaped, projectRecord, tempRoom, typed } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: the log's path is bound when its module loads, and a suite
   that imports first writes to the developer's own log. */
const sandbox = tempRoom("forge-codex-read-");
process.env.XDG_CONFIG_HOME = sandbox;
delete process.env.FORGE_CODEX_DISABLE;

const { digest, locate } = await import("../../../src/codex/codex-api.mjs");
const { logConsult, logPath } = await import("../../../src/codex/codex-log.mjs");
const { repoRoot } = await import("../../../src/git/repo-root.mjs");
const { readOrRefuse } = await import("../../../src/codex/codex-read.mjs");
const { WRITE_READ_OWED } = await import("../../../src/ladder.mjs");
const { NO_GATEWAY_REASON, STOOD_DOWN_REASON } = await import("../../../src/codex/log/unavailable.mjs");

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

/* The rung's rounds line and this refusal are the two counts a run reads, and a run at a lighter
   rung reads the line first: told it buys one consult, it meets this and has to know whether this
   is the one, or the stand-down below is the cheaper-looking answer (ISS-1322). */
test("the refusal says this read is owed at every rung, before it offers the stand-down", () => {
  const { root, path } = room();
  const refusal = refusalOf(path, root);
  assert.match(refusal, /at every rung, and no rung drops it/u);
  assert.ok(refusal.includes(WRITE_READ_OWED),
    "the refusal spells the owed read some other way than the rung's rounds print it (ISS-2303)");
  assert.ok(refusal.indexOf("every rung") < refusal.indexOf("FORGE_CODEX_DISABLE"),
    "a run reads that the read is owed before it reads what would stand the check down");
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

/* The same rel under another root is another file, so a consult there read something else (ISS-904). */
test("a consult of the same name under another root read another file", () => {
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
  assert.ok(logPath().startsWith(sandbox), `${logPath()} is outside ${sandbox}`);
});

/* The caller posts these bytes and never reads again: between a second read and the first sits a
   tracker round trip, and the field would carry the file nobody was shown. Unjudged bytes come back
   too, under a refusal, so a caller can refuse the file's own shape before spending a consult on it
   (ISS-483); what keeps them off the tracker is the refusal beside them, which every caller raises. */
test("what comes back is the text that was judged, and unjudged text arrives under a refusal", () => {
  const { root, path, rel } = room();
  consulted(root, rel, PLAN, { id: "byte01" });
  assert.deepEqual(readOrRefuse(path, root), { refusal: null, text: PLAN });
  writeFileSync(path, "swapped after the read\n");
  const seen = readOrRefuse(path, root);
  assert.equal(seen.text, "swapped after the read\n");
  assert.match(seen.refusal, /its text has changed since/u);
  assert.equal(readOrRefuse(root, root).text, null, "and a path no read could reach carries none");
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
  assert.match(away, new RegExp(`cd ${escaped(typed(root))}( |/)?.*&& echo`, "u"), away);
  assert.doesNotMatch(refusalOf(join(root, "plan.md"), root), /cd .* &&/u);
});

/* This module hands the two halves back and composes neither: `flow/record/record.mjs` is what pairs the refusal
   with the unchecked reader, and `plugin/test/flow/record/plan/plan.test.mjs` watches that pairing's kill switch. So a
   composing export belongs there and not here, where only its own case would reach it. */
test("the judged bytes come back with no refusal, which is what a caller composes", () => {
  const { root, path, rel } = room();
  consulted(root, rel, PLAN, { id: "seat01" });
  assert.deepEqual(readOrRefuse(path, root), { refusal: null, text: PLAN });
  writeFileSync(path, "never judged\n");
  process.env.FORGE_CODEX_DISABLE = "1";
  try {
    assert.deepEqual(readOrRefuse(path, root), { refusal: null, text: null, unread: STOOD_DOWN_REASON },
      "and under the kill switch there is no refusal and no judged text, which is what `?? bodyFrom(path)` fell through on,"
      + " and the reason the write goes through unread, which it posts on the issue (ISS-2932)");
  } finally {
    delete process.env.FORGE_CODEX_DISABLE;
  }
});

/* ISS-2932: a reviewer that could not answer, told apart from a consult nobody asked for. The gateway
   is this suite's own profile, one holding both halves or none, so no case reads this machine's. */
const GATEWAY = join(sandbox, "gateway.env");
writeFileSync(GATEWAY, "ANTHROPIC_BASE_URL=https://gateway.invalid\nANTHROPIC_AUTH_TOKEN=planted\n");
const withGateway = (configured, read) => {
  const was = process.env.CLAUDE_PROXY_ENV;
  process.env.CLAUDE_PROXY_ENV = configured ? GATEWAY : join(sandbox, "no-gateway.env");
  try {
    return read();
  } finally {
    if (was === undefined) delete process.env.CLAUDE_PROXY_ENV;
    else process.env.CLAUDE_PROXY_ENV = was;
  }
};
const reading = (root, consult) => projectRecord(root, sandbox, { slug: "fixture", ...(consult ? { codex: { consult } } : {}) });
/* A consult row as `forge codex consult` writes one when the gateway gives nothing back. */
const failed = (root, rel, text, over = {}) => consulted(root, rel, text, { ok: false, reply: undefined, ...over });

test("an advisory reading takes a file whose newest consult the gateway could not give, and says why", () => {
  for (const name of ["plan.md", "criteria.md"]) {
    const { root } = room();
    const path = join(root, name);
    writeFileSync(path, PLAN);
    const { rel } = locate(root, path);
    reading(root, "advisory");
    failed(root, rel, PLAN, { id: "fa1l01", status: 503, error: "gateway answered 503: All codex accounts are unavailable" });
    const got = withGateway(true, () => readOrRefuse(path, root));
    assert.equal(got.refusal, null, `${name} goes through: the gateway, not the agent, is why nothing read it`);
    assert.equal(got.text, PLAN, "and the bytes the write takes are the ones the failed consult carried");
    assert.equal(got.unread, "gateway unavailable (503), consult fa1l01", "the reason the write posts names the status and the consult");
  }
});

test("a failure with no HTTP status is named by the error's first line", () => {
  const { root, path, rel } = room();
  reading(root, "advisory");
  failed(root, rel, PLAN, { id: "t1me01", error: "The operation was aborted due to timeout\nat fetch" });
  assert.equal(withGateway(true, () => readOrRefuse(path, root)).unread,
    "gateway unavailable (The operation was aborted due to timeout), consult t1me01");
});

test("an advisory reading still refuses a file no consult was asked about, naming the consult that clears it", () => {
  const { root, path } = room();
  reading(root, "advisory");
  const refusal = withGateway(true, () => refusalOf(path, root));
  assert.match(refusal, /No consult has read plan\.md/u, "nothing failed here, so nothing tells a reviewer that was down");
  assert.match(refusal, /forge codex consult --send bodies plan\.md/u);
  assert.doesNotMatch(refusal, /gateway unavailable|No consult can be asked/u);
});

test("a failed consult of other bytes speaks for nothing, advisory or not", () => {
  const { root, path, rel } = room();
  reading(root, "advisory");
  failed(root, rel, "an older plan\n", { id: "01d001", status: 503 });
  assert.match(withGateway(true, () => refusalOf(path, root)), /No consult has read plan\.md/u);
});

test("an advisory reading with no gateway configured takes a file nobody could have consulted on", () => {
  const { root, path } = room();
  reading(root, "advisory");
  const got = withGateway(false, () => readOrRefuse(path, root));
  assert.equal(got.refusal, null);
  assert.equal(got.unread, NO_GATEWAY_REASON);
});

test("a required reading refuses a file whose consult failed, naming the status and the declaration that lets it through", () => {
  for (const consult of [null, "required"]) {
    const { root, path, rel } = room();
    reading(root, consult);
    failed(root, rel, PLAN, { id: "req503", status: 503 });
    const refusal = withGateway(true, () => refusalOf(path, root));
    assert.match(refusal, /got nothing back: gateway unavailable \(503\), consult req503/u, `${consult ?? "absent"}: the status is named`);
    assert.match(refusal, /forge doctor --set codex\.consult=advisory/u, "and the declaration that lets the write proceed");
    assert.match(refusal, /forge codex consult --send bodies plan\.md/u, "and the consult, which may answer now");
  }
});

test("a newer consult that answered speaks for the bytes, so an older failure lets nothing through", () => {
  const { root, path, rel } = room();
  reading(root, "advisory");
  failed(root, rel, PLAN, { id: "01dfa1", status: 503, at: new Date(Date.now() - 60_000).toISOString() });
  consulted(root, rel, PLAN, { id: "d1ffok", send: "diffs" });
  const refusal = withGateway(true, () => refusalOf(path, root));
  assert.match(refusal, /Consult d1ffok named plan\.md but sent its diff/u, "the answered diff is the newest word on these bytes");
  assert.doesNotMatch(refusal, /gateway unavailable/u);
});

/* Criterion 20: one reading of a row, not four. Asked of the sources, since every behavioural case
   here would stay green over a caller that kept a copy of its own. */
test("the writes and both doors judge a file's consult through the one classifier", () => {
  const src = (rel) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");
  for (const rel of ["src/codex/codex-read.mjs", "src/codex/log/owed-refusal.mjs"]) {
    assert.match(src(rel), /import \{[^}]*\bconsultState\b[^}]*\} from "\.\/(log\/)?unavailable\.mjs"/u, `${rel} imports the classifier`);
    assert.match(src(rel), /consultState\(\{/u, `${rel} calls it`);
  }
  for (const rel of ["hooks/gates/codex/codex-second.mjs", "hooks/gates/codex/codex-owed.mjs"]) {
    assert.match(src(rel), /unreadApart\(/u, `${rel} judges through the shared split`);
    assert.doesNotMatch(src(rel), /gatewayFailed|isAnswered/u, `${rel} reads no row for itself`);
  }
});
