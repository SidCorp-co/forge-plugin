/* ISS-1819: a rewrite under `translate: vi` can add a qualifying clause, drop a contrast or swap a
   term, and the write still lands at exit 0 — nothing compared what was sent against what was kept.
   AC-04-9-1..3 (docs/requirements/srs/fr-04-typed-records.md) print the source beside the posted
   text for every rewritten field but the title, so the one person who can catch the drift sees both
   in the same round as the write. Each case runs `translated()` itself, since the thing under test
   is the stderr the write boundary prints and not a function some other layer only claims to call. */
import assert from "node:assert/strict";
import test from "node:test";

import { projectRoom, ranAsync } from "../fixtures.mjs";
import { gatewayOn } from "./fake-gateway.mjs";

const LAYER = new URL("../../src/tools/vi.mjs", import.meta.url);

/** `translated(payload)`, called in a child process against a fake gateway, since the room a
 *  project's settings resolve from is read off `process.cwd()`/`HOME` at import time. */
const translatedIn = async (t, reply, payload, prefix) => {
  const room = await gatewayOn(t, reply, prefix);
  projectRoom(room, room, { slug: "any", translate: "vi" });
  const call = `import(${JSON.stringify(LAYER.href)})`
    + `.then((m) => console.log(JSON.stringify(m.translated(${JSON.stringify(payload)}))))`;
  return ranAsync(process.execPath, ["-e", call], { ...process.env, HOME: room, XDG_CONFIG_HOME: room }, room);
};

test("every rewritten field but the title prints its source beside what was posted", async (t) => {
  const source = "Connect a statement source to a bank account.";
  const run = await translatedIn(t, (text) => `${text} that already has a source connected`,
    { acceptanceCriteria: source }, "rewrite-vis-changed-");
  assert.equal(run.status, 0, run.stderr);
  const posted = JSON.parse(run.stdout).acceptanceCriteria;
  assert.notEqual(posted, source, "the fixture reply has to actually change the field, or it proves nothing");
  assert.match(run.stderr, /--- acceptanceCriteria as sent ---\n.*Connect a statement source/u,
    `the source is shown under its own heading:\n${run.stderr}`);
  assert.match(run.stderr, new RegExp(`--- acceptanceCriteria as sent ---\\n${source}\\n`, "u"),
    "the sent block holds the source byte for byte, not the rewrite's echo of it");
  assert.match(run.stderr, /--- acceptanceCriteria as posted ---/u, run.stderr);
  const sentAt = run.stderr.indexOf("as sent");
  const postedAt = run.stderr.indexOf("as posted");
  assert.ok(sentAt >= 0 && sentAt < postedAt, "what was sent reads before what was posted");
});

test("every non-title field of PROSE_FIELDS gets the same treatment, not only acceptanceCriteria", async (t) => {
  const cases = [
    { field: "description", payload: { description: "A body the change touches." } },
    { field: "body", payload: { body: "A comment body, rewritten same as any other field." } },
    { field: "plan", payload: { plan: "## Steps\n\n1. Do the one thing. — criteria: 1" } },
    { field: "releaseNotes.userFacing", payload: { releaseNotes: { userFacing: "What they will see." } } },
  ];
  for (const { field, payload } of cases) {
    const run = await translatedIn(t, (text) => `${text} (rewritten)`, payload, "rewrite-vis-field-");
    assert.equal(run.status, 0, `${field}:\n${run.stderr}`);
    assert.match(run.stderr, new RegExp(`--- ${field.replace(".", "\\.")} as sent ---`, "u"),
      `${field} shows its source:\n${run.stderr}`);
    assert.match(run.stderr, new RegExp(`--- ${field.replace(".", "\\.")} as posted ---`, "u"),
      `${field} still shows what was posted:\n${run.stderr}`);
  }
});

test("a title still prints only what was posted", async (t) => {
  const source = "Ban dich tu dong them menh de";
  const run = await translatedIn(t, (text) => `${text} rewritten`, { title: source }, "rewrite-vis-title-");
  assert.equal(run.status, 0, run.stderr);
  assert.notEqual(JSON.parse(run.stdout).title, source, "the fixture reply has to change the title");
  assert.doesNotMatch(run.stderr, /as sent/u, `a title stays posted-only:\n${run.stderr}`);
  assert.match(run.stderr, /--- title as posted ---/u, run.stderr);
});

test("a field the rewrite left unrewritten prints no source block", async (t) => {
  const source = "A body the gateway hands back exactly as it was given.";
  const run = await translatedIn(t, (text) => text, { description: source }, "rewrite-vis-same-");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).description, source);
  assert.doesNotMatch(run.stderr, /as sent/u, `nothing to compare a field against itself:\n${run.stderr}`);
  assert.match(run.stderr, /--- description as posted ---/u, run.stderr);
});
