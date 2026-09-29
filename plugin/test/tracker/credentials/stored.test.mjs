/* The guard's split between what a write re-sends from the stored record and what its caller
   supplied, and the masked copy a redaction writes: one matching rule read three ways (ISS-1380). */
import assert from "node:assert/strict";
import test from "node:test";

import {
  credentialHits,
  credentialLeak,
  deployFrom,
  redactedCopy,
  stagingOf,
  storedCopies,
} from "../../../src/tracker/project-config.mjs";

const HELD = stagingOf({ preview: { url: "https://beta.example.test" },
  testCredentials: [{ username: "qa@example.test", password: "correct-horse-battery" }] });

/* What the tracker already stores is re-sent rather than supplied, and only that: a string it does not
   hold word for word in the same field is the caller's, and judged exactly as before (ISS-1380). */
test("a string the stored record already holds goes, and anything else carrying a credential is refused", () => {
  const deploy = deployFrom(HELD);
  const stored = { sessionContext: { reviewFeedback: ["signed in with correct-horse-battery"] } };
  const resent = { sessionContext: { reviewFeedback: ["signed in with correct-horse-battery"], lease: { holder: "me" } } };
  assert.equal(credentialLeak(resent, deploy, stored), null, "the stored copy re-sent is not the caller's");
  assert.deepEqual(storedCopies(resent, deploy, stored).map((one) => one.field), ["sessionContext.reviewFeedback.0"]);
  assert.equal(credentialLeak(resent, deploy).field, "sessionContext.reviewFeedback.0", "with no stored record, as before");
  const added = { sessionContext: { ...resent.sessionContext, note: "and again, correct-horse-battery" } };
  assert.equal(credentialLeak(added, deploy, stored).field, "sessionContext.note",
    "a string the tracker does not hold is refused though a stored one beside it goes");
  assert.equal(credentialLeak({ body: "signed in with correct-horse-battery" }, deploy, stored).field, "body",
    "and a field the stored record is not of is judged whole, word for word the same or not");
});

/* A value the stored record holds at one leaf path is not the same field as the exact same text
   written fresh at another leaf path under the same top-level key: the exemption is only as wide
   as "this value, at this path, is already stored", not "this value, somewhere in this top-level
   field" (ISS-2837). */
test("a stored copy moved to another sessionContext path is refused, not read as already stored", () => {
  const deploy = deployFrom(HELD);
  const stored = { sessionContext: { reviewFeedback: ["signed in with correct-horse-battery"] } };
  const moved = { sessionContext: { reviewFeedback: ["signed in with correct-horse-battery"],
    note: "signed in with correct-horse-battery" } };
  assert.equal(credentialLeak(moved, deploy, stored).field, "sessionContext.note",
    "the same text word for word, but at a path the stored record does not hold it at, is the caller's");
  assert.deepEqual(storedCopies(moved, deploy, stored).map((one) => one.field), ["sessionContext.reviewFeedback.0"],
    "the leaf path that does match is still read as the stored resend it is");
});

test("a redaction masks a long credential where it is written exactly, and its bare form nowhere", () => {
  const deploy = deployFrom(stagingOf({ testCredentials: [{ password: "!hunter2hunter2!" }] }));
  assert.deepEqual(redactedCopy({ note: "hunter2hunter2 then !hunter2hunter2!" }, deploy),
    { note: "hunter2hunter2 then [withheld]" }, "the guard refuses no string for the bare form alone");
});

test("a string carrying two credentials is a hit for each, stored or supplied", () => {
  const deploy = deployFrom(stagingOf({ testCredentials: [{ username: "long-test-username", password: "long-test-password" }] }));
  const both = { sessionContext: { feedback: ["long-test-username / long-test-password"] } };
  const hits = credentialHits(both, deploy);
  assert.deepEqual(hits.map((one) => [one.field, one.credential]), [
    ["sessionContext.feedback.0", "test credentials · username"],
    ["sessionContext.feedback.0", "test credentials · password"],
  ]);
  assert.equal(storedCopies(both, deploy, both).length, 2, "and a re-sent copy names both");
  assert.equal(credentialLeak(both, deploy).credential, "test credentials · username",
    "while a refusal still names the first, as it did");
});

test("a redacted copy masks what the guard refuses and leaves every other string as it was", () => {
  const deploy = deployFrom(stagingOf({ testCredentials: [{ username: "admin", password: "correct-horse-battery" }] }));
  const value = { feedback: ["the admin screen", " admin ", "used correct-horse-battery twice: correct-horse-battery"],
    count: 3, branch: "iss-1" };
  assert.deepEqual(redactedCopy(value, deploy), { feedback: ["the admin screen", "[withheld]",
    "used [withheld] twice: [withheld]"], count: 3, branch: "iss-1" });
  assert.equal(credentialLeak(redactedCopy(value, deploy), deploy), null, "and nothing the guard refuses is left");
});
