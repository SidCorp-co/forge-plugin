/* ISS-1886: a run id handed bare in a comment came back from the Vietnamese rewrite with its trailing
   letter gone, because nothing marked it as a name. Each case runs the write boundary a caller spawns
   against a gateway that behaves like the model that did it — it drops the last character of every
   name it can see — so a case passes only where the name never reached it. */
import assert from "node:assert/strict";
import test from "node:test";

import { protectInline } from "../../vi-natural/format/doc.mjs";
import { translatedIn } from "./fake-gateway.mjs";

const NAMES = /\b(?:qa-0919c|ISS-1886|1de6fc8e|run_id|translatedBody)\b/gu;
const sent = [];
/** The model that lost the `c`: every name it is shown loses its last character. */
const dropping = (text) => {
  sent.push(text);
  return text.replace(NAMES, (name) => name.slice(0, -1));
};
const posted = async (t, payload, field) => {
  sent.length = 0;
  const run = await translatedIn(t, dropping, payload, "bare-names-");
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout)[field];
};

test("a bare run id, issue key and sha in a body are stored byte for byte", async (t) => {
  const body = "Six passing verdicts from qa-0919c still stand for ISS-1886 at 1de6fc8e.";
  assert.equal(await posted(t, { body }, "body"), body);
  assert.doesNotMatch(sent.join("\n"), NAMES, "no name reached the gateway");
});

test("a title's bare names and code spans are stored byte for byte", async (t) => {
  const title = "qa-0919c credits `run_id` for ISS-1886";
  assert.equal(await posted(t, { title }, "title"), title);
  assert.doesNotMatch(sent.join("\n"), NAMES, "the title went out held, as a body does");
});

test("a bare snake_case or camelCase name is stored byte for byte in a body and a title", async (t) => {
  const text = "The run_id is read by translatedBody";
  assert.equal(await posted(t, { description: `${text}.` }, "description"), `${text}.`);
  assert.equal(await posted(t, { title: text }, "title"), text);
});

test("a rewrite that loses a held name is refused and nothing is posted", async (t) => {
  for (const payload of [{ body: "Six verdicts from qa-0919c stand." }, { title: "Verdicts from qa-0919c" }]) {
    const run = await translatedIn(t, (text) => text.replace(/⟦VI\d+⟧/gu, "qa-0919"), payload, "bare-names-lost-");
    assert.notEqual(run.status, 0, `the write is refused:\n${run.stdout}`);
    assert.equal(run.stdout, "", "no payload came out to be posted");
    assert.match(run.stderr, /code span or placeholder token lost/u, `the refusal says why:\n${run.stderr}`);
    if (payload.body) assert.match(run.stderr, /block 0: /u, "and which block");
  }
});

/* A figure is held since ISS-2104, as a name is; a list's own number is Markdown and stays prose. */
test("words, hyphenated words, ordinals and a list's own numbers still reach the rewrite as prose", async (t) => {
  const prose = "1. The 3rd end-to-end run of 3rd-party code on the 21st\n2) the second item";
  const slots = [];
  assert.equal(protectInline(prose, slots), prose);
  assert.deepEqual(slots, []);
  for (const [payload, field] of [[{ body: prose }, "body"], [{ title: prose }, "title"]]) {
    assert.equal(await posted(t, payload, field), prose);
    assert.deepEqual(sent, [prose], `the ${field} reached the gateway as it was written, with no sentinel`);
  }
});
