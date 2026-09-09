/* The one writer every verb that sets a content field goes through. The cap cases are the point: a
   release note over the limit was refused nine times after the write instead of once before it
   (ISS-46, ISS-346), and the route refuses a length without naming the number it wanted. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempHome } from "../fixtures.mjs";

const HOME = tempHome("field-write");
mkdirSync(join(HOME.path, "forge"), { recursive: true });
writeFileSync(join(HOME.path, "forge", "config.json"), JSON.stringify({ url: "https://stub.example/mcp", token: "t" }));
process.env.XDG_CONFIG_HOME = HOME.path;
process.env.FORGE_SESSION_ID = "field-write-session";

const ISSUE = "22222222-2222-4222-8222-222222222222";
const FENCE_OPEN = "\u27E6UNTRUSTED_DATA source=\"issue.acceptanceCriteria\"\u27E7";
const FENCE_SHUT = "\u27E6END_UNTRUSTED_DATA\u27E7";
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
/* The lease's own updates, kept apart: the point of several cases is how many of each went out. */
let leaseWrites = [];
/* Each call in the order it was made, so a case can say the gate ran before the value existed. */
let trail = [];
/* Stands in for the tracker handing a stored object back in its own key order, or another run's. */
let readBack = null;
/* Stands in for a project's prose pipeline: what the boundary sends when it is not what was typed. */
let rewrite = null;

const answer = (body) => ({ ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify(body) });

globalThis.fetch = async (address, init = {}) => {
  const url = new URL(address);
  if (url.pathname === "/api/projects") return answer([{ id: "p-1", slug: "forge-plugin" }]);
  if (url.pathname.startsWith("/api/projects/")) return answer({ id: "p-1", slug: "forge-plugin" });
  if (url.pathname.endsWith("/comments")) {
    trail.push("forge_comments:list");
    return answer({ items: [], returned: 0, total: 0, limit: 0, offset: 0, hasMore: false });
  }
  if ((init.method ?? "GET") === "PATCH") {
    trail.push("forge_issues:update");
    const sent = JSON.parse(init.body);
    const data = rewrite ? rewrite(sent) : sent;
    if (data.sessionContext) leaseWrites.push(data.sessionContext);
    else updates.push(data);
    for (const [key, value] of Object.entries(data)) stored[key] = value;
    return answer({ id: ISSUE, ...data });
  }
  trail.push("forge_issues:get");
  const held = stored.sessionContext ?? lease().sessionContext;
  return answer({ id: ISSUE, ...stored, sessionContext: readBack ? readBack(held) : held });
};

const { capChecked, capRefusal, capsOf, lengthOf, rowOf, writeField, writeFields } = await import("../../src/tracker/field-write.mjs");

class Refused extends Error {}
const refuse = (message) => {
  throw new Refused(message);
};

const setting = async (field, value) => {
  stored = {};
  updates = [];
  leaseWrites = [];
  trail = [];
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

/* The route refuses a bad length without naming the number it wanted, so the numbers are this CLI's
   own declaration and a field it does not name is uncapped here — which is a call the tracker gets
   to refuse, and never a crash on the way out. */
test("the caps are the table's declaration, and a field it does not name is not capped here", async () => {
  const caps = capsOf();
  assert.equal(caps.plan.self, 200_000, "the declared cap is read");
  assert.equal(caps.releaseNotes.halves.userFacing, 500, "and so is a cap on a half of an object field");
  assert.equal(caps.acceptanceCriteria.self, 100_000);
  assert.equal(caps.releaseNotes.halves.technical, 500);
  assert.equal(caps.releaseNotes.halves.section, null, "a half the declaration does not cap carries none");
  assert.equal(caps.sessionContext, undefined, "and a field it names nothing for is absent");
  const said = [];
  capChecked("sessionContext", caps, "x".repeat(9_000), "x".repeat(9_000), (one) => said.push(one),
    rowOf("sessionContext"));
  assert.deepEqual(said, [], "an absent row is uncapped, not a throw");
});

test("a note over the cap is refused, and the note is never sent", async () => {
  const said = await refusedBy("releaseNotes", { section: "Added", userFacing: "x".repeat(501), technical: null });
  assert.match(said, /releaseNotes\.userFacing/u, "the refusal names the field");
  assert.match(said, /capped at 500/u, "and the cap the schema declares");
  assert.match(said, /is 501/u, "and the length it measured");
  assert.equal(updates.length, 0, "and no update carried the note");
});

/* ISS-325 spent seven rounds on one note: four shortening `userFacing`, and only then three more on
   a `technical` nothing had said was over, because the loop refused on the first half it measured. */
test("a note over on both halves is refused once, naming each half and each overage", async () => {
  const said = await refusedBy("releaseNotes",
    { section: "Added", userFacing: "x".repeat(511), technical: "y".repeat(522) });
  assert.match(said, /releaseNotes\.userFacing is capped at 500 code points and this one is 511/u);
  assert.match(said, /releaseNotes\.technical is capped at 500 code points and this one is 522/u);
  assert.match(said, /Shorten it by 11\./u, "the first overage");
  assert.match(said, /Shorten it by 22\./u, "and the second, in the same refusal");
  assert.equal(said.match(/Nothing was sent/gu).length, 1, "one write refused once, not once per half");
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

test("a criteria field the tracker fenced reads back as written, and is not called a change", async () => {
  rewrite = (data) => (data.acceptanceCriteria
    ? { ...data, acceptanceCriteria: `${FENCE_OPEN}\n${data.acceptanceCriteria}\n${FENCE_SHUT}` }
    : data);
  await setting("acceptanceCriteria", "1. one outcome a reader could check");
  assert.equal(updates.length, 1, "the write landed: the transport took the fence, and it is no rewrite");
  rewrite = null;
});

/* A note half is compared byte for byte, so the read path may take the tracker's fence off a body
   and may not touch anything else: a strip written as a trim refuses this write after it landed. */
test("a note half keeps the whitespace its author wrote, and reads back with no refusal", async () => {
  const note = { section: "Fixed", userFacing: "the marker no longer shows  ", technical: "" };
  const back = await setting("releaseNotes", note);
  assert.deepEqual(back, note, "every half as it was sent, trailing spaces included");
  assert.equal(updates.length, 1);
});

/* The half the whole cap check turns on: `onSent` is handed the copy the boundary rewrote, and the
   decision is that copy's. A check reading the caller's value instead passes every case above. */
test("the cap is measured on what the boundary sent, not on what the author typed", async () => {
  const caps = capsOf();
  const under = { section: "Added", userFacing: "x".repeat(443), technical: null };
  const grew = { ...under, userFacing: "y".repeat(600) };
  assert.throws(
    () => capChecked("releaseNotes", caps, grew, under, refuse, rowOf("releaseNotes")),
    /is 600/u,
    "a source inside the cap that the rewrite pushed over it is refused, on the rewrite's length",
  );
  const over = { section: "Added", userFacing: "x".repeat(600), technical: null };
  const shrank = { ...over, userFacing: "y".repeat(443) };
  assert.doesNotThrow(
    () => capChecked("releaseNotes", caps, shrank, over, refuse, rowOf("releaseNotes")),
    "and a source over the cap that the rewrite brought under it is not refused at all",
  );
});

test("a field the writer does not own is refused by name", async () => {
  await assert.rejects(() => setting("description", "a body"), (error) => {
    assert.match(error.message, /not a field this writer sets/u);
    assert.match(
      error.message,
      /plan, acceptanceCriteria, releaseNotes, sessionContext/u,
      "and the ones it does are named",
    );
    return true;
  });
});

/* The lease joined this table on ISS-451, and the four cases below are the four things that separate
   its row from a content field's: it renews nothing, it shows the comments itself, its value may be
   a thunk, and its compare is blind to the key order the tracker answers in. */
test("the lease's write renews nothing, so one update goes out where a content field sends two", async () => {
  await setting("sessionContext", lease().sessionContext);
  assert.equal(leaseWrites.length, 1, "a renewing row would have written the lease twice");
  assert.equal(updates.length, 0, "and nothing else was written");

  await setting("acceptanceCriteria", "1. one outcome a reader could check");
  assert.equal(updates.length, 1, "the content field itself");
  assert.equal(leaseWrites.length, 1, "and the renewal that carries it, which is the row's own write");
});

/* The delivery reaches a content write only through that renewal, which is the consequence of the
   row property: a content row written `renews: false` would stop showing comments and fail nothing. */
test("a content write is shown its unshown comments, by way of the renewal", async () => {
  await setting("plan", "a plan with words in it");
  assert.ok(trail.includes("forge_comments:list"), "the gate never ran for the content write");
  assert.ok(
    trail.indexOf("forge_comments:list") < trail.lastIndexOf("forge_issues:update"),
    "and it ran before the field itself was written",
  );
});

test("the gate runs before a value that is a thunk is resolved, because the write is built on the last read", async () => {
  const value = async () => {
    trail.push("resolved");
    return lease().sessionContext;
  };
  await setting("sessionContext", value);
  assert.ok(trail.includes("resolved"), "the thunk was never called");
  assert.ok(
    trail.indexOf("forge_comments:list") < trail.indexOf("resolved"),
    `the comments were not shown before the value was built: ${trail.join(" ")}`,
  );
  assert.ok(trail.indexOf("resolved") < trail.lastIndexOf("forge_issues:update"), "and it was built before the send");
  assert.equal(leaseWrites.length, 1, "one write carried the resolved value");
});

test("the lease reads back through its own key order, and a long line in it is measured by nothing", async () => {
  readBack = (held) => JSON.parse(JSON.stringify(held, Object.keys(held.lease).reverse().concat("lease")));
  const long = { lease: { ...lease().sessionContext.lease, next: "x".repeat(4000) } };
  const back = await setting("sessionContext", long);
  assert.equal(leaseWrites.length, 1, "the write went out");
  assert.equal(leaseWrites[0].lease.next.length, 4000, "with the line whole, since nothing caps this field");
  assert.ok(back, "and a read-back in another key order is the same lease, not a mismatch");
  readBack = null;
});

test("a lease that came back another run's is refused in the lease's own words", async () => {
  readBack = () => ({
    lease: {
      holder: "another-session", agent: "b", pid: "9",
      renewedAt: "2026-09-06T04:00:00.000Z", minutes: 30, next: null, history: [],
    },
  });
  const said = await refusedBy("sessionContext", lease().sessionContext);
  readBack = null;
  assert.match(said, /did not read back as written/u, "the lease's sentence, not the generic one");
  assert.match(said, /another-session/u, "AC-03-2-1: the run that holds it");
  assert.match(said, /expiring 2026-09-06T04:30/u, "its renew time, read out of the lease");
  assert.match(said, /forge claim ISS-9/u, "and the one command that clears it");
});

/* The several-field arm the recorded override spends (ISS-930). Its whole reason is that one update
   carries the set: a loop here would put the partial write back, with a correction per field or one
   naming a subset. The cap, the read-back and the mismatch are still each field's own. */
const settingAll = async (...pairs) => {
  stored = {};
  updates = [];
  leaseWrites = [];
  trail = [];
  return writeFields(ISSUE, pairs, { ref: "ISS-9", refuse, override: true });
};

test("several fields go out as one update, and the read-back answers for each of them", async () => {
  const back = await settingAll({ field: "complexity", value: "m" }, { field: "priority", value: "high" });
  assert.equal(updates.length, 1, `one request, not one per field: ${JSON.stringify(updates)}`);
  assert.deepEqual(updates[0], { complexity: "m", priority: "high" }, "carrying every field it was given");
  assert.equal(back.complexity, "m", "and the row it returns holds each of them as the tracker read it back");
  assert.equal(back.priority, "high");
  assert.equal(trail.filter((one) => one === "forge_issues:update").length, 2,
    "the renewal and the write, which is what one content field costs too");
});

test("one renewal for the set, not one per field", async () => {
  await settingAll({ field: "complexity", value: "m" }, { field: "priority", value: "high" }, { field: "category", value: "bug" });
  assert.equal(leaseWrites.length, 1, `three fields renewed the lease ${leaseWrites.length} times`);
});

test("a field of the set that did not read back is named, and the ones that did are not", async () => {
  rewrite = (sent) => ({ ...sent, priority: "low" });
  const said = await assert.rejects(
    () => settingAll({ field: "complexity", value: "m" }, { field: "priority", value: "high" }),
    (error) => {
      assert.match(error.message, /priority did not read back as written/u, error.message);
      assert.doesNotMatch(error.message, /complexity did not read back/u,
        "the field that landed is not reported as one that did not");
      return true;
    },
  );
  rewrite = null;
  return said;
});

test("the cap is read per field of the payload, so one over it names itself and not the set", async () => {
  const said = await assert.rejects(
    () => settingAll({ field: "plan", value: "p" }, { field: "title", value: "t".repeat(501) }),
    (error) => {
      assert.match(error.message, /title is capped at 500 code points and this one is 501/u, error.message);
      return true;
    },
  );
  assert.equal(updates.length, 0, "and the payload was never sent, the cap being read before the send");
  return said;
});

test("one field through the several-field sender is what the single-field caller still gets", async () => {
  const one = await settingAll({ field: "priority", value: "high" });
  assert.deepEqual(updates, [{ priority: "high" }], "one field, one update, the same payload as before");
  assert.equal(one.priority, "high");
  const bare = await setting("acceptanceCriteria", "1. one outcome a reader could check");
  assert.equal(bare, "1. one outcome a reader could check",
    "and writeField still answers with the field's own value rather than the row");
});
