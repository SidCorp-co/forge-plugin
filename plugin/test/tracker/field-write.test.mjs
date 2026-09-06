/* The one writer every verb that sets a content field goes through. The cap cases are the point:
   the tracker declares `maxLength` and nothing read it, so a release note over the limit was refused
   nine times after the write instead of once before it (ISS-46, ISS-346). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { FIXTURE_CAPS, tempHome } from "../fixtures.mjs";

const HOME = tempHome("field-write");
mkdirSync(join(HOME.path, "forge"), { recursive: true });
writeFileSync(join(HOME.path, "forge", "config.json"), JSON.stringify({ url: "https://stub.example/mcp", token: "t" }));
process.env.XDG_CONFIG_HOME = HOME.path;
process.env.FORGE_SESSION_ID = "field-write-session";

const ISSUE = "22222222-2222-4222-8222-222222222222";
const FENCE_OPEN = "\u27E6UNTRUSTED_DATA source=\"issue.acceptanceCriteria\"\u27E7";
const FENCE_SHUT = "\u27E6END_UNTRUSTED_DATA\u27E7";
/* The tracker's own declaration, not a second copy of it: a stub that flattens the unions the real
   schema uses is a stub against which an unwired cap reader passes. */
const CAPS = FIXTURE_CAPS;

const lease = () => ({
  sessionContext: {
    lease: {
      holder: "field-write-session", agent: "a", pid: "1",
      renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [],
    },
  },
});

/* What the tracker stored, so a read-back answers the write rather than a constant. */
let stored = {};
let updates = [];
/* Stands in for a project's prose pipeline: what the boundary sends when it is not what was typed. */
let rewrite = null;

globalThis.fetch = async (url, init) => {
  const call = JSON.parse(init.body);
  const args = call.params?.arguments ?? {};
  const name = call.params?.name;
  let result = {
    tools: [
      { name: "forge_issues", inputSchema: { properties: { data: { properties: CAPS } } } },
      { name: "forge_comments", inputSchema: { properties: {} } },
    ],
  };
  if (name === "forge_comments") result = { structuredContent: { comments: [], returned: 0, hasMore: false } };
  if (name === "forge_issues" && args.action === "get") {
    const fields = args.fields ?? [];
    result = { structuredContent: fields.includes("sessionContext")
      ? { sessionContext: stored.sessionContext ?? lease().sessionContext }
      : { [fields[0]]: stored[fields[0]] ?? null } };
  }
  if (name === "forge_issues" && args.action === "update") {
    const data = rewrite ? rewrite(args.data) : args.data;
    if (!data.sessionContext) updates.push(data);
    for (const [key, value] of Object.entries(data)) stored[key] = value;
    result = { structuredContent: { documentId: ISSUE, ...data } };
  }
  return { ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result }) };
};

const { capChecked, capRefusal, capsIn, capsOf, lengthOf, writeField } = await import("../../src/tracker/field-write.mjs");

class Refused extends Error {}
const refuse = (message) => {
  throw new Refused(message);
};

const setting = async (field, value) => {
  stored = {};
  updates = [];
  return writeField(ISSUE, field, value, { ref: "ISS-9", refuse });
};

const refusedBy = async (field, value) => {
  await assert.rejects(() => setting(field, value), Refused);
  try {
    await setting(field, value);
    return "";
  } catch (error) {
    return error.message;
  }
};

test("the caps come off the schema, and a field it does not cap is not capped here", async () => {
  const caps = await capsOf();
  assert.equal(caps.plan.self, 200_000, "the declared cap is read");
  assert.equal(caps.releaseNotes.halves.userFacing, 500, "and so is a cap on a half of an object field");
  assert.equal(caps.acceptanceCriteria.self, 100_000, "through the null branch a nullable field declares");
  assert.equal(caps.releaseNotes.halves.technical, 500, "and through a nullable half's own branches");
  assert.equal(caps.releaseNotes.halves.section, null, "a half the schema does not cap carries none");
  const two = { anyOf: [{ type: "string", maxLength: 100 }, { type: "string", maxLength: 200 }] };
  assert.equal(capsIn({ f: two }).f.self, 200, "a union takes what any branch takes, so the widest is the cap");
  const open = { anyOf: [{ type: "string", maxLength: 100 }, { type: "string" }] };
  assert.equal(capsIn({ f: open }).f.self, null, "and a branch taking text uncapped means no cap is proven");
  const listed = { anyOf: [{ type: "string", maxLength: 100 }, { type: ["string", "null"], maxLength: 300 }] };
  assert.equal(capsIn({ f: listed }).f.self, 300, "a type given as a list counts as taking text");
  const loose = { anyOf: [{ type: "string", maxLength: 100 }, { type: ["string", "null"] }] };
  assert.equal(capsIn({ f: loose }).f.self, null, "including when that is the branch declaring no cap");
  const holed = { anyOf: [{ type: "string", maxLength: 100 }, null] };
  assert.equal(capsIn({ f: holed }).f.self, null, "a branch that is not an object is read, not thrown on");
  assert.equal(caps.sessionContext, undefined, "and a field it declares nothing for is absent");
});

test("a note over the cap is refused, and the note is never sent", async () => {
  const said = await refusedBy("releaseNotes", { section: "Added", userFacing: "x".repeat(501), technical: null });
  assert.match(said, /releaseNotes\.userFacing/u, "the refusal names the field");
  assert.match(said, /capped at 500/u, "and the cap the schema declares");
  assert.match(said, /is 501/u, "and the length it measured");
  assert.equal(updates.length, 0, "and no update carried the note");
});

test("a half the schema does not cap is written however long it is", async () => {
  await setting("releaseNotes", { section: "x".repeat(4000), userFacing: "short", technical: null });
  assert.equal(updates.length, 1, "the write went out");
  assert.equal(updates[0].releaseNotes.section.length, 4000, "with the uncapped half whole");
});

test("the length is counted in code points, so what only overflows as code units is the tracker's to judge", async () => {
  assert.equal(lengthOf("\u{1F600}"), 1, "one code point");
  assert.equal("\u{1F600}".length, 2, "and two code units, which is the pair that could disagree");
  await setting("releaseNotes", { section: "Added", userFacing: "\u{1F600}".repeat(400), technical: null });
  assert.equal(updates.length, 1, "400 code points is inside a 500 cap and was sent");
});

test("the refusal names the length that was sent and the author's, where a rewrite moved one", async () => {
  const said = capRefusal("releaseNotes.userFacing", 500, "y".repeat(600), "x".repeat(443));
  assert.match(said, /is 600/u, "the length measured is the rewrite's");
  assert.match(said, /You wrote 443/u, "and the author is told their own");
  assert.match(said, /100 has to come off what was posted/u, "and which of the two to shorten");
  assert.doesNotMatch(capRefusal("plan", 10, "z".repeat(12), "z".repeat(12)), /You wrote/u, "no rewrite, one length");
});

test("the comparator is the field's own, and so is the refusal it gives", async () => {
  rewrite = (data) => (data.plan !== undefined ? { ...data, plan: "" } : data);
  assert.match(
    await refusedBy("plan", "a plan with words in it"),
    /still has no plan/u,
    "a plan stored empty is refused in the plan row's own words",
  );
  rewrite = (data) =>
    (data.releaseNotes ? { ...data, releaseNotes: { ...data.releaseNotes, technical: "moved" } } : data);
  assert.match(
    await refusedBy("releaseNotes", { section: "Added", userFacing: "u", technical: "t" }),
    /releaseNotes did not read back as written/u,
    "and a note whose half moved is refused on the half, in the generic one",
  );
  rewrite = null;
});

test("a criteria field reads back through the tracker's own fence and is not called a change", async () => {
  rewrite = (data) => (data.acceptanceCriteria
    ? { ...data, acceptanceCriteria: `${FENCE_OPEN}\n${data.acceptanceCriteria}\n${FENCE_SHUT}` }
    : data);
  await setting("acceptanceCriteria", "1. one outcome a reader could check");
  assert.equal(updates.length, 1, "the write landed: the fence is the wrapping, not a rewrite");
  rewrite = null;
});

/* The half the whole cap check turns on: `onSent` is handed the copy the boundary rewrote, and the
   decision is that copy's. A check reading the caller's value instead passes every case above. */
test("the cap is measured on what the boundary sent, not on what the author typed", async () => {
  const caps = await capsOf();
  const under = { section: "Added", userFacing: "x".repeat(443), technical: null };
  const grew = { ...under, userFacing: "y".repeat(600) };
  assert.throws(
    () => capChecked("releaseNotes", caps, grew, under, refuse),
    /is 600/u,
    "a source inside the cap that the rewrite pushed over it is refused, on the rewrite's length",
  );
  const over = { section: "Added", userFacing: "x".repeat(600), technical: null };
  const shrank = { ...over, userFacing: "y".repeat(443) };
  assert.doesNotThrow(
    () => capChecked("releaseNotes", caps, shrank, over, refuse),
    "and a source over the cap that the rewrite brought under it is not refused at all",
  );
});

test("a field the writer does not own is refused by name", async () => {
  await assert.rejects(() => setting("sessionContext", { lease: {} }), (error) => {
    assert.match(error.message, /not a field this writer sets/u);
    assert.match(error.message, /plan, acceptanceCriteria, releaseNotes/u, "and the ones it does are named");
    return true;
  });
});
