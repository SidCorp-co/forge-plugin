/* What the wrapped verbs expose. The cost assertions are the point: "narrow, then fetch again" is
   a measurement or it is a slogan, and a projection that does not shrink the payload is not one. */
import assert from "node:assert/strict";
import test from "node:test";

import { terse, uploaded, urlBearing } from "../src/commands.mjs";

/* The shape forge_uploads returns, as observed on ISS-22's one attachment. */
const ATTACHMENT = {
  id: "56d4641e-fd47-4a80-b468-2c602265ce85",
  name: "image.png",
  mime: "image/png",
  size: 157346,
  createdAt: "2026-08-29T08:50:04.206Z",
  url: "/api/attachments/56d4641e-fd47-4a80-b468-2c602265ce85/download",
};

const bytes = (value) => JSON.stringify(value).length;

test("an attachment collapses to the url that fetches it", () => {
  assert.deepEqual(terse({ attachments: [ATTACHMENT] }), { attachments: [ATTACHMENT.url] });
});

test("collapsing an attachment costs less than carrying it", () => {
  const before = bytes({ attachments: [ATTACHMENT] });
  const after = bytes(terse({ attachments: [ATTACHMENT] }));
  assert.ok(after < before, `${after} should be under ${before}`);
  assert.ok(after / before < 0.5, `kept ${((after / before) * 100).toFixed(0)}% — expected under half`);
});

test("the saving scales with the attachment count", () => {
  const many = { attachments: Array.from({ length: 10 }, () => ATTACHMENT) };
  assert.ok(bytes(terse(many)) / bytes(many) < 0.5);
  assert.equal(terse(many).attachments.length, 10);
});

test("nothing else in the record is touched", () => {
  const record = { issueId: "ISS-22", plan: "# a plan", relations: { blocks: [], blockedBy: [] } };
  assert.deepEqual(terse(record), record);
});

test("an array of plain values survives", () => {
  assert.deepEqual(terse({ fields: ["plan", "status"] }), { fields: ["plan", "status"] });
});

test("an element without a url keeps its fields", () => {
  const relation = { issueId: "ISS-23", kind: "blocks" };
  assert.deepEqual(terse({ relations: [relation] }), { relations: [relation] });
});

test("a url that is not a string is not mistaken for one", () => {
  assert.equal(urlBearing({ url: 12 }), false);
  assert.equal(urlBearing(null), false);
  assert.equal(urlBearing("string"), false);
});

test("an upload reply prints its url, and an unexpected body prints whole", () => {
  assert.equal(uploaded(JSON.stringify(ATTACHMENT)), ATTACHMENT.url);
  assert.equal(uploaded("502 Bad Gateway"), "502 Bad Gateway");
  assert.equal(uploaded('{"error":"denied"}'), '{"error":"denied"}');
});
