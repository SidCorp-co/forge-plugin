/* The token row says whether the endpoint takes the token and as whom, never only that one is set (ISS-101). */
import assert from "node:assert/strict";
import test from "node:test";

import { tokenRow } from "../../../../src/tools/services/doctor/harness.mjs";

const FROM = "/home/a/.config/forge/config.json";

test("a token the endpoint takes is named with the account it authenticates as", () => {
  const row = tokenRow("set (78 chars)", FROM, { user: { name: "Operator One" } });
  assert.equal(row.level, "ok");
  assert.match(row.detail, /^set \(78 chars\) {2}← \/home\/a\/\.config\/forge\/config\.json — authenticates as Operator One$/u);
});

test("a token fenced to projects authenticates, and the row says its account is not readable through it", () => {
  const row = tokenRow("set (78 chars)", FROM, { refused: "PAT_ACCOUNT_ROUTE: account route", status: 403, code: "PAT_ACCOUNT_ROUTE" });
  assert.equal(row.level, "ok");
  assert.match(row.detail, /authenticates; fenced to projects/u);
});

test("a token the endpoint refuses is a miss naming the refusal and the command that replaces it", () => {
  const row = tokenRow("set (78 chars)", FROM, { refused: "UNAUTHORIZED: token revoked\nmore", status: 401 });
  assert.equal(row.level, "miss");
  assert.match(row.detail, /the endpoint refuses it: UNAUTHORIZED: token revoked — `forge doctor --token <pat>`/u);
});

test("any other refusal leaves whom it authenticates as unread, and with no endpoint asked the row is presence alone", () => {
  assert.equal(tokenRow("set", FROM, { refused: "Forge did not answer", status: null }).level, "note");
  assert.equal(tokenRow("set", FROM, null).detail, `set  ← ${FROM}`);
});
