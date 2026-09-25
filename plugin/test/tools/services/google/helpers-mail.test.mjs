/* The mail helpers against the fake: the RFC 2822 text a send carries, the threading a reply adds,
   and the unread mail cut to sender, subject and date. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../../fixtures.mjs";
import { ENV_ACCESS, google, googleHome, startFake } from "./fake.mjs";

let fake = null;
let home = null;
let room = null;

before(async () => {
  fake = await startFake();
  home = googleHome(fake);
  room = tempRoom("google-helpers-mail-");
});

after(() => fake?.close());

const ran = async (...argv) => {
  fake.requests.length = 0;
  return google(home, argv, { env: { FORGE_GOOGLE_ACCESS_TOKEN: ENV_ACCESS }, cwd: room });
};

const SEND = "/gmail/v1/users/me/messages/send";

const sentRaw = () => {
  const [sent] = fake.sent("POST", SEND);
  const body = JSON.parse(sent.body.toString("utf8"));
  return { ...body, text: Buffer.from(body.raw, "base64url").toString("utf8") };
};

const b64 = (text) => Buffer.from(text, "utf8").toString("base64");

test("+send sends one message whose raw text carries the recipient, the subject and the body", async () => {
  fake.answers[`POST ${SEND}`] = () => [200, { id: "M9", threadId: "T9" }];
  const answer = await ran("+send", "--to", "alice@example.com", "--subject", "Quarterly", "--body", "The numbers are in.", "--yes");
  assert.equal(answer.status, 0, answer.stderr);
  const { text } = sentRaw();
  assert.match(text, /^To: alice@example\.com\r$/mu);
  assert.match(text, /^Subject: Quarterly\r$/mu);
  assert.ok(text.includes(b64("The numbers are in.")));
  assert.equal(JSON.parse(answer.stdout).id, "M9");
});

test("+send --attach carries the file as a MIME attachment", async () => {
  writeFileSync(join(room, "q3.csv"), "a,b\n");
  fake.answers[`POST ${SEND}`] = () => [200, { id: "M10" }];
  const answer = await ran("+send", "--to", "a@x.com", "--subject", "S", "--body", "B", "--attach", "q3.csv", "--yes");
  assert.equal(answer.status, 0, answer.stderr);
  const { text } = sentRaw();
  assert.match(text, /Content-Type: multipart\/mixed; boundary=/u);
  assert.match(text, /Content-Disposition: attachment; filename="q3\.csv"/u);
  assert.ok(text.includes(b64("a,b\n")));
});

test("+reply threads onto the original, to its sender, with In-Reply-To, References and a Re: subject", async () => {
  fake.answers["GET /gmail/v1/users/me/messages/M1"] = () => [200, { id: "M1", threadId: "T1", payload: { headers: [
    { name: "From", value: "Bob <bob@example.com>" }, { name: "Subject", value: "Hello" },
    { name: "Message-ID", value: "<orig@example.com>" }] } }];
  fake.answers[`POST ${SEND}`] = () => [200, { id: "M2", threadId: "T1" }];
  const answer = await ran("+reply", "M1", "--body", "Thanks.", "--yes");
  assert.equal(answer.status, 0, answer.stderr);
  const sent = sentRaw();
  assert.equal(sent.threadId, "T1");
  assert.match(sent.text, /^To: Bob <bob@example\.com>\r$/mu);
  assert.match(sent.text, /^Subject: Re: Hello\r$/mu);
  assert.match(sent.text, /^In-Reply-To: <orig@example\.com>\r$/mu);
  assert.match(sent.text, /^References: <orig@example\.com>\r$/mu);
});

test("+triage prints each unread message as its sender, subject and date", async () => {
  fake.answers["GET /gmail/v1/users/me/messages"] = (seen) => [200, seen.query.get("q") === "is:unread" ? { messages: [{ id: "u1" }] } : {}];
  fake.answers["GET /gmail/v1/users/me/messages/u1"] = () => [200, { id: "u1", threadId: "t1", payload: { headers: [
    { name: "From", value: "carol@example.com" }, { name: "Subject", value: "Invoice" }, { name: "Date", value: "Thu, 24 Sep 2026 09:00:00 +0700" }] } }];
  const answer = await ran("+triage");
  assert.equal(answer.status, 0, answer.stderr);
  assert.deepEqual(JSON.parse(answer.stdout), [{ id: "u1", threadId: "t1", from: "carol@example.com", subject: "Invoice",
    date: "Thu, 24 Sep 2026 09:00:00 +0700" }]);
});
