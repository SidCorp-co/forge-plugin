/* ISS-2104: a release note stated a metre total a thousand times too large, because the rewrite swapped
   the separators of 12.371, and a merge subject stated a quantity it was never given, because the
   pronoun "one" came back as the numeral 1. Each case runs the boundary a caller spawns against a
   gateway that behaves like the model that did it, so a case passes only where the figure never
   reached it or where what it wrote was refused. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { ranAsync } from "../../fixtures.mjs";
import { gatewayOn, translatedIn } from "../fake-gateway.mjs";

const BUNDLED = fileURLToPath(new URL("../../../bin/vi-natural", import.meta.url));
const NOTE = "The converted quantity and the metre total both read 12.371 at 4.85 kilograms per metre.";

const sent = [];
/** What reached the gateway, with the sentinels standing in for what was held. */
const reached = () => sent.join("\n").replace(/⟦VI\d+⟧/gu, "");
/** The model that wrote 12,371: every figure it is shown has its two separators swapped. */
const swapping = (text) => {
  sent.push(text);
  return text.replace(/\d+(?:[.,]\d+)+/gu, (figure) => figure.replace(/[.,]/gu, (mark) => (mark === "." ? "," : ".")));
};
/** The model that wrote 1: the pronoun "one" comes back as a numeral. */
const numbering = (text) => text.replace(/\bone\b/gu, "1");

const posted = async (t, reply, payload, field) => {
  sent.length = 0;
  const run = await translatedIn(t, reply, payload, "figures-");
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout)[field];
};

test("a figure in a body is stored spelled as it was sent, and never reaches the model", async (t) => {
  for (const field of ["body", "description", "plan", "acceptanceCriteria"]) {
    assert.equal(await posted(t, swapping, { [field]: NOTE }, field), NOTE, `${field} kept its figures`);
    assert.doesNotMatch(reached(), /\d/u, `no figure of the ${field} reached the gateway`);
  }
});

test("a figure in a title is stored spelled as it was sent, and never reaches the model", async (t) => {
  const title = "The metre total reads 12.371 at 4.85 kilograms per metre";
  assert.equal(await posted(t, swapping, { title }, "title"), title);
  assert.doesNotMatch(reached(), /\d/u, "no figure of the title reached the gateway");
});

test("a tracker write whose rewrite adds a figure posts nothing and names the figure", async (t) => {
  const said = "When the weight per metre cell is cleared, the document records it as one the system worked out.";
  for (const payload of [{ body: said }, { title: said }]) {
    const run = await translatedIn(t, numbering, payload, "figures-added-");
    assert.notEqual(run.status, 0, `the write is refused:\n${run.stdout}`);
    assert.equal(run.stdout, "", "no payload came out to be posted");
    assert.match(run.stderr, /carries the figure\(s\) 1, which the source does not/u, `the refusal names it:\n${run.stderr}`);
  }
});

const ran = (room, argv) => ranAsync(BUNDLED, argv, { ...process.env, XDG_CONFIG_HOME: room }, room);

test("translate --kind prose refuses a translation that respells or adds a figure, naming it", async (t) => {
  for (const [reply, source, figure] of [
    [swapping, "12.371 and 4.85", /12,371, 4,85/u],
    [numbering, "Records the weight as one the system worked out", /figure\(s\) 1,/u],
  ]) {
    const room = await gatewayOn(t, reply, "figures-prose-");
    const run = await ran(room, ["translate", "--kind", "prose", "--no-glossary", source]);
    assert.notEqual(run.status, 0, `refused:\n${run.stdout}`);
    assert.equal(run.stdout, "", "nothing a script could push");
    assert.match(run.stderr, figure, `the figure is named:\n${run.stderr}`);
  }
});

test("a ui string and a locale file are judged as they were before", async (t) => {
  const room = await gatewayOn(t, swapping, "figures-ui-");
  const string = await ran(room, ["translate", "--no-glossary", "Up to 12.371 items"]);
  assert.equal(string.status, 0, string.stderr);
  assert.equal(string.stdout, "Up to 12,371 items\n", "a ui string is localised, separators and all");
  writeFileSync(join(room, "en.json"), JSON.stringify({ limit: "Up to 12.371 items" }));
  const locale = await ran(room, ["i18n", "en.json", "--no-glossary"]);
  assert.equal(locale.status, 0, locale.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(room, "vi.json"), "utf8")), { limit: "Up to 12,371 items" });
});
