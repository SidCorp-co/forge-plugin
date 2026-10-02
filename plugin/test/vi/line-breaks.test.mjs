/* ISS-2331: a body filed on a project whose prose language is vi stored every line break inside a
   table or a list as the two characters backslash and n, so both tables rendered as one line. The
   model answered each block as the JSON string it was handed, escapes and all. Each case runs the
   verb a caller spawns against a gateway that answers the same way, so a case passes only where what
   was written holds the source's lines. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ranAsync } from "../fixtures.mjs";
import { gatewayOn, translatedIn } from "./fake-gateway.mjs";

const BUNDLED = fileURLToPath(new URL("../../bin/vi-natural", import.meta.url));

const BODY = [
  "## Measured",
  "",
  "| collection | present before | active before |",
  "|---|---|---|",
  "| products | yes | no |",
  "",
  "- the first item names the route",
  "- the second item names the screen",
  "",
].join("\n");

/** The model that filed ISS-246: every line break and tab inside a block comes back as its escape. */
const escaping = (text) => text.replace(/\n/gu, "\\n").replace(/\t/gu, "\\t");

const docWith = async (t, source, reply) => {
  const room = await gatewayOn(t, reply, "vi-breaks-");
  writeFileSync(join(room, "body.md"), source);
  const run = await ranAsync(BUNDLED, ["doc", "-o", "body.vi.md", "body.md", "--no-glossary"],
    { ...process.env, XDG_CONFIG_HOME: room }, room);
  return { ...run, written: readFileSync(join(room, "body.vi.md"), "utf8") };
};

test("a table and a list whose line breaks the model escaped are written one row and one item a line", async (t) => {
  const run = await docWith(t, BODY, escaping);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(run.written.split("\n"), BODY.split("\n"), "the same lines, in the same order");
  assert.doesNotMatch(run.written, /\\[nt]/u, "and no escape the source did not hold");
});

test("a tab the model escaped is written back as a tab", async (t) => {
  const source = "Columns:\n\tfirst\tsecond\n";
  const run = await docWith(t, source, escaping);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.written, source);
});

/** A source holding both escapes as text, and answers each moving one kind's count while keeping the other. */
const AS_TEXT = "The stored body reads \\n between rows and \\t between cells.\nThe next row follows.\n";
const MOVED = [
  ["adds a \\n", escaping, /holds 2 \\n escape\(s\) where the source holds 1/u],
  ["adds a \\t", (text) => text.replace(" between cells", "\\t between cells"), /holds 2 \\t escape\(s\) where the source holds 1/u],
  ["drops the \\n", (text) => text.replace("\\n ", ""), /holds 0 \\n escape\(s\) where the source holds 1/u],
  ["drops the \\t", (text) => text.replace("\\t ", ""), /holds 0 \\t escape\(s\) where the source holds 1/u],
  ["swaps the \\n for a \\t", (text) => text.replace("\\n", "\\t"), /holds 0 \\n escape\(s\) where the source holds 1 and 2 \\t/u],
];

test("a block holding either escape as text whose answer adds, drops or swaps one is left in English and named", async (t) => {
  for (const [what, reply, named] of MOVED) {
    const run = await docWith(t, AS_TEXT, reply);
    assert.equal(run.status, 2, `${what}: a block left in English is the code a caller reads:\n${run.stderr}`);
    assert.equal(run.written, AS_TEXT, `${what}: the file kept the source rather than the moved escape`);
    assert.match(run.stderr, new RegExp(`block 0: .*${named.source}`, "u"), `${what}:\n${run.stderr}`);
  }
});

test("a block holding one escape kind or both as text whose answer keeps exactly those is written with them", async (t) => {
  const onlyBreak = "The stored body reads \\n between rows.\nThe next row follows.\n";
  const onlyTab = "The stored body reads \\t between cells.\nThe next row follows.\n";
  for (const source of [onlyBreak, onlyTab, AS_TEXT]) {
    const run = await docWith(t, source, (text) => text);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.written, source);
  }
});

/* Every prose field but the title is sent as a document, the release note's nested half among them. */
const BODY_FIELDS = [["description"], ["body"], ["plan"], ["acceptanceCriteria"], ["releaseNotes", "userFacing"]];
const nested = ([key, ...rest], value) => ({ [key]: rest.length ? nested(rest, value) : value });

test("every prose field but the title, holding a table and a list, posts through the write boundary with the lines it was sent", async (t) => {
  const sent = BODY.trimEnd();
  for (const path of BODY_FIELDS) {
    const run = await translatedIn(t, escaping, nested(path, sent), "vi-breaks-write-");
    assert.equal(run.status, 0, run.stderr);
    const posted = path.reduce((held, key) => held[key], JSON.parse(run.stdout));
    assert.deepEqual(posted.split("\n"), sent.split("\n"), `${path.join(".")} kept its lines`);
  }
});
