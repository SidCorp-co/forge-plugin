/* The form table read as a table: what each row builds, what it says it did, and the two claims the
   table cannot make about itself — that every status something advances to has a form, and that no
   form is a verb. The forms typed at the real dispatcher are did-you-mean.test.mjs's. */
import assert from "node:assert/strict";
import test from "node:test";

import { FORMS, MOVES, argvOf, handledBy, refusedFor, saidFor } from "../../src/resolve/handler.mjs";
import { ORDER } from "../../src/flow/earned.mjs";
import { VERB_NAMES } from "../../src/resolve/visibility.mjs";

test("every status something advances to has a form, and open has none", () => {
  for (const status of ORDER.slice(1)) {
    assert.ok(MOVES[status], `${status} is in the order table and no form names it`);
  }
  assert.equal(Object.hasOwn(MOVES, ORDER[0]), false, `nothing advances to ${ORDER[0]}, so no form may`);
  const targets = Object.values(MOVES);
  assert.equal(new Set(targets).size, targets.length, "and two statuses do not share one word");
});

test("a form is not a verb, and every form names a verb this CLI has", () => {
  for (const [form, { verb }] of Object.entries(FORMS)) {
    assert.equal(VERB_NAMES.includes(form), false, `${form} is a verb of its own, so its row is unreachable`);
    assert.ok(VERB_NAMES.includes(verb), `${form} is handled by ${verb}, which no verb answers to`);
  }
  assert.equal(handledBy("issue"), null, "a verb is answered by itself and never by a row");
  assert.equal(handledBy("nosuchword"), null);
});

/* Behind the reference, because advance refuses a flag there and a turn spent on that refusal is what the table exists to avoid. */
test("a status form names its target to advance and leaves the rest as typed", () => {
  assert.deepEqual(argvOf("close", ["ISS-45"]), ["ISS-45", "--to", "closed"]);
  assert.deepEqual(argvOf("start", ["ISS-45", "--next", "go on"]),
    ["ISS-45", "--to", "in_progress", "--next", "go on"]);
  assert.deepEqual(argvOf("confirm", []), [], "and a form given no reference hands advance its own usage");
  assert.deepEqual(argvOf("close", ["--owed"]), ["--owed"],
    "a flag where the reference goes is advance's refusal to make, not the table's");
});

test("drop and park reach the paths advance judges them by", () => {
  assert.deepEqual(argvOf("drop", ["ISS-45", "--why", "w"]), ["ISS-45", "--drop", "--why", "w"]);
  assert.deepEqual(argvOf("park", ["ISS-45", "--kind", "blocked", "--why", "w"]),
    ["ISS-45", "--park", "blocked", "--why", "w"], "the one word every other verb asks a kind by");
  /* With no kind the row still hands `--park` over, so advance's own line about a flag with no value answers rather than an ordinary move. */
  assert.deepEqual(argvOf("park", ["ISS-45"]), ["ISS-45", "--park"]);
  assert.deepEqual(argvOf("park", ["ISS-45", "--park", "blocked"]), ["ISS-45", "--park", "blocked"],
    "and the flag advance's own name for it is not doubled");
});

/* `flags` keeps the last value, so a close carrying both targets advanced to the caller's — a form performing a move its own word does not name (F2). */
test("a status form refuses a second target rather than letting one overwrite its own", () => {
  const said = refusedFor("close", ["ISS-45", "--to", "approved"]);
  assert.match(said, /^close is the form for closed/u, said);
  assert.match(said, /forge advance/u, "and the verb that does take a target is named");
  assert.equal(refusedFor("close", ["ISS-45"]), null, "a form given no second target is no refusal");
  assert.equal(refusedFor("drop", ["ISS-45", "--to", "closed"]), null,
    "and a form that names no target of its own is advance's to judge");
  assert.equal(refusedFor("list", ["--status", "open"]), null);
});

test("a read form is handed on untouched", () => {
  assert.deepEqual(argvOf("list", ["--status", "open"]), ["--status", "open"]);
  assert.deepEqual(argvOf("get", ["ISS-45", "--fields", "status"]), ["ISS-45", "--fields", "status"]);
  assert.deepEqual(argvOf("issues", []), []);
});

/* One line, on stderr, naming the reference only where one was given: a machine reading the verb's
   stdout is unaffected, and `forge stats runs` counts a form off this line and nothing else. */
test("the line says which form ran as which verb, and names a reference only when there is one", () => {
  assert.equal(saidFor("close", ["ISS-45"]), "forge: read close as forge advance ISS-45");
  assert.equal(saidFor("list", ["--status", "open"]), "forge: read list as forge issue");
  assert.equal(saidFor("list", []), "forge: read list as forge issue");
  assert.equal(saidFor("comments", ["ISS-45"]), "forge: read comments as forge comment ISS-45");
});
