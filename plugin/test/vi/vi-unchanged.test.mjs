/* The verb is proved through the wrapper a caller actually spawns, because the thing under test is
   the number that reaches a shell, not a function's return. The gateway is a local server that
   answers with whatever it was asked (ISS-84), so no live call is spent on a code. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { projectRecord, ranAsync } from "../fixtures.mjs";
import { gatewayOn as served } from "./fake-gateway.mjs";
import { TRANSLATE_UNCHANGED } from "../../src/tools/vi-exit.mjs";

const BUNDLED = fileURLToPath(new URL("../../bin/vi-natural", import.meta.url));
const LAYER = new URL("../../src/tools/vi.mjs", import.meta.url);
const SOURCE = "git fetch origin";

const gatewayOn = (t, reply) => served(t, reply, "vi-unchanged-");
const ran = (room, argv) => ranAsync(BUNDLED, argv, { ...process.env, XDG_CONFIG_HOME: room }, room);
const translate = (room, text) => ran(room, ["translate", "--kind", "prose", "--no-glossary", text]);

test("a string handed back as it was sent leaves by its own code, named once on stderr", async (t) => {
  const room = await gatewayOn(t, (text) => text);
  const run = await translate(room, SOURCE);
  assert.equal(run.status, TRANSLATE_UNCHANGED, `the code a caller reads:\n${run.stderr}`);
  assert.equal(run.stdout, `${SOURCE}\n`, "stdout still carries it and nothing else, which is the right answer");
  const named = run.stderr.split("\n").filter((line) => line.includes(SOURCE));
  assert.equal(named.length, 1, `one line names the string that came back:\n${run.stderr}`);
});

test("a string the gateway translated leaves by zero, with nothing said about it", async (t) => {
  const room = await gatewayOn(t, (text) => `translated: ${text}`);
  const run = await translate(room, SOURCE);
  assert.equal(run.status, 0, `nothing is owed for a string that changed:\n${run.stderr}`);
  assert.equal(run.stdout, `translated: ${SOURCE}\n`);
  assert.ok(!run.stderr.includes("unchanged"), `and nothing is said of it:\n${run.stderr}`);
});

test("the usage text lists the code, so a caller learns it without reading the source", async () => {
  const run = await ranAsync(BUNDLED, ["-h"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(`· ${TRANSLATE_UNCHANGED} translate only:`, "u"));
});

test("i18n and doc leave by the codes they always have, where every string came back as it went in", async (t) => {
  const room = await gatewayOn(t, (text) => text);
  writeFileSync(join(room, "en.json"), JSON.stringify({ save: "Save" }));
  writeFileSync(join(room, "readme.md"), "One paragraph of prose, waiting to be translated.\n");
  const locale = await ran(room, ["i18n", "en.json", "--no-glossary"]);
  assert.equal(locale.status, 0, `a locale file gained no code from translate's:\n${locale.stderr}`);
  const document = await ran(room, ["doc", "readme.md", "--no-glossary"]);
  assert.equal(document.status, 0, `nor did a document:\n${document.stderr}`);
});

test("a title handed back as it was sent is still posted by the layer forge writes titles through", async (t) => {
  const room = await gatewayOn(t, (text) => text);
  /* The room is the configuration home here, the gateway's own file living beside the record of the
     project the room belongs to, so a checkout is what the room has to be. */
  spawnSync("git", ["init", "-q", room], { cwd: room });
  projectRecord(room, room, { slug: "any", translate: "vi" });
  const call = `import("${LAYER.href}")`
    + `.then((m) => console.log(JSON.stringify(m.translated({ title: ${JSON.stringify(SOURCE)} }))))`;
  const run = await ranAsync(process.execPath, ["-e", call],
    { ...process.env, HOME: room, XDG_CONFIG_HOME: room }, room);
  assert.equal(run.status, 0, `the write is not refused on a title with nothing to translate:\n${run.stderr}`);
  assert.deepEqual(JSON.parse(run.stdout), { title: SOURCE }, "and the title stands as it was written");
});
