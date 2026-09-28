/* ISS-1752: a rewrite that drops the contrast or the negation a source states posted at exit 0,
   because the only check `translatedBody()` ran was a count of blocks left wholly in English —
   never a comparison of what a translated block says against what it was given. `drift.diff` is
   that comparison; it is proved directly, then through `vi-natural doc` end to end (ISS-1016's own
   pattern, in vi-marker.test.mjs), then through the write boundary a caller actually spawns
   (rewrite-visibility.test.mjs's own pattern), so the thing under test at every layer is the code
   and the text a caller reads, not a function some other layer only claims to call. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { projectRoom, ranAsync } from "../fixtures.mjs";
import { gatewayOn } from "./fake-gateway.mjs";
import { diff } from "../../vi-natural/text/drift.mjs";
import { translateItems } from "../../vi-natural/gateway/engine.mjs";

const BIN = fileURLToPath(new URL("../../bin/vi-natural", import.meta.url));
const LAYER = new URL("../../src/tools/vi.mjs", import.meta.url);

test("drift.diff: a dropped contrast with no Vietnamese counterpart is named", () => {
  const source = "Store the balance as negative rather than as one somebody has signed.";
  const dropped = "Lưu số dư dưới dạng âm và cũng gọi là số có dấu.";
  const found = diff(source, dropped);
  assert.match(found, /contrasts one reading against another/u, found);
});

test("drift.diff: the same contrast kept in the rewrite's own words is not flagged", () => {
  const source = "Store the balance as negative rather than as one somebody has signed.";
  const kept = "Lưu số dư dưới dạng âm, thay vì gọi là số có dấu.";
  assert.equal(diff(source, kept), null);
});

test("drift.diff: a dropped negation with no Vietnamese negation marker is named", () => {
  const source = "Do not enable this without confirmation.";
  const dropped = "Bật tính năng này khi xác nhận.";
  const found = diff(source, dropped);
  assert.match(found, /negates a claim/u, found);
});

test("drift.diff: the same negation kept is not flagged", () => {
  const source = "Do not enable this without confirmation.";
  const kept = "Đừng bật tính năng này khi chưa xác nhận.";
  assert.equal(diff(source, kept), null);
});

test("drift.diff: a rewrite of prose with neither construct is never flagged", () => {
  assert.equal(diff("The gate reads the scoped paths off its own script.", "Cổng đọc đường dẫn phạm vi từ script của nó."), null);
});

test("drift.diff: a non-string source or candidate answers null rather than throwing", () => {
  assert.equal(diff(undefined, "x"), null);
  assert.equal(diff("x", undefined), null);
});

/** `vi-natural doc` over one document, every block answered with `reply` of what was sent — the
 *  same helper `vi-marker.test.mjs` uses for the marker it proves. */
const docWith = async (t, source, reply, prefix) => {
  const room = await gatewayOn(t, reply, prefix);
  writeFileSync(join(room, "body.md"), source);
  const run = await ranAsync(BIN, ["doc", "-o", "body.vi.md", "body.md", "--no-glossary"],
    { ...process.env, XDG_CONFIG_HOME: room }, room);
  return { ...run, path: join(room, "body.vi.md") };
};

test("vi-natural doc leaves a dropped-contrast block in English and exits 2", async (t) => {
  const source = "Store the balance as negative rather than as one somebody has signed.\n";
  const run = await docWith(t, source, () => "Lưu số dư dưới dạng âm và cũng gọi là số có dấu.\n", "vi-drift-doc-contrast-");
  assert.equal(run.status, 2, `a drift-rejected block is left in English:\n${run.stderr}`);
  assert.equal(readFileSync(run.path, "utf8"), source, "the file kept the source rather than the flipped rewrite");
  assert.match(run.stderr, /contrasts one reading against another/u, run.stderr);
});

test("vi-natural doc leaves a dropped-negation block in English and exits 2", async (t) => {
  const source = "Do not enable this without confirmation.\n";
  const run = await docWith(t, source, () => "Bật tính năng này khi xác nhận.\n", "vi-drift-doc-negation-");
  assert.equal(run.status, 2, `a drift-rejected block is left in English:\n${run.stderr}`);
  assert.equal(readFileSync(run.path, "utf8"), source);
  assert.match(run.stderr, /negates a claim/u, run.stderr);
});

test("vi-natural doc posts a rewrite that keeps its contrast in its own words", async (t) => {
  const source = "Store the balance as negative rather than as one somebody has signed.\n";
  const kept = "Lưu số dư dưới dạng âm, thay vì gọi là số có dấu.";
  const run = await docWith(t, source, () => kept, "vi-drift-doc-faithful-");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(readFileSync(run.path, "utf8"), `${kept}\n`);
});

/** `translated(payload)` through the write boundary a caller spawns, against a fake gateway —
 *  `rewrite-visibility.test.mjs`'s own pattern. */
const translatedIn = async (t, reply, payload, prefix) => {
  const room = await gatewayOn(t, reply, prefix);
  projectRoom(room, room, { slug: "any", translate: "vi" });
  const call = `import(${JSON.stringify(LAYER.href)})`
    + `.then((m) => console.log(JSON.stringify(m.translated(${JSON.stringify(payload)}))))`;
  return ranAsync(process.execPath, ["-e", call], { ...process.env, HOME: room, XDG_CONFIG_HOME: room }, room);
};

test("the write boundary refuses a field whose rewrite drops the source's contrast, before anything posts", async (t) => {
  const source = "Store the balance as negative rather than as one somebody has signed.";
  const run = await translatedIn(t, () => "Lưu số dư dưới dạng âm và cũng gọi là số có dấu.",
    { description: source }, "vi-drift-write-");
  assert.equal(run.status, 1, `the field's own drift refuses the whole write:\n${run.stderr}`);
  assert.match(run.stderr, /could not write the Vietnamese/u, run.stderr);
  assert.match(run.stderr, /contrasts one reading against another/u,
    `the reason vi-natural gave reaches the run, not only a block count:\n${run.stderr}`);
  assert.match(run.stderr, /This is the command that writes it/u, "the refusal hands over the producing command");
});

test("the write boundary still posts a field whose rewrite keeps the source's contrast", async (t) => {
  const source = "Store the balance as negative rather than as one somebody has signed.";
  const kept = "Lưu số dư dưới dạng âm, thay vì gọi là số có dấu.";
  const run = await translatedIn(t, () => kept, { description: source }, "vi-drift-write-ok-");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).description, kept);
});

/* codex's own review of this issue (F2): the batch pass rejects a drift-flagged candidate, but the
   retry that follows asked the model again with no word of why the first answer was turned back —
   the same blind second try a placeholder or a CTA rejection never got either, until this fix. */
test("a candidate the batch pass rejects for drift gets its retry told the reason, not asked blind", async () => {
  const asked = [];
  const client = {
    chat: async (system, user) => {
      asked.push(user);
      // Every call answers the same drifted candidate, so a passing run here proves the reason
      // reached the retry prompt rather than that a second, luckier answer happened to pass.
      return JSON.stringify({ a: "Lưu số dư dưới dạng âm và cũng gọi là số có dấu." });
    },
  };
  const source = "Store the balance as negative rather than as one somebody has signed.";
  const { problems } = await translateItems(client, [["a", source]], { verify: diff });
  assert.equal(asked.length, 2, "the batch, then one retry");
  assert.doesNotMatch(asked[0], /rejected|contrasts one reading/u, "the first ask carries no verdict on itself");
  assert.match(asked[1], /contrasts one reading against another/u,
    `the retry is told what the first answer was rejected for:\n${asked[1]}`);
  assert.equal(problems.length, 1, "still rejected twice, since the retry answered the same drifted text");
});

/* codex's own review of this issue (F1): the plan's own words scoped the exit-code fix to "a verify
   problem", but the code answers `2` for any surviving problem, a drift rejection among them and not
   the only one. `doc()` already answers `2` this same broad way for every kind of failure a block
   can end in — a verify rejection, a gateway hiccup on the retry, an empty reply twice over — so
   parity with it is the whole of what `translate --kind doc` owes, and covering only the drift case
   would be one contract dressed as agreement with another. Proven on the kind `doc()` never needed a
   test for either: an empty reply, twice, with no drift and no gateway error in it at all. */
test("vi-natural doc and translate --kind doc answer the same exit code for a reply that never comes", async (t) => {
  const room = await gatewayOn(t, () => "", "vi-drift-empty-");
  writeFileSync(join(room, "body.md"), "Nothing about this sentence contrasts or negates anything.\n");
  const asDoc = await ranAsync(BIN, ["doc", "-o", "body.vi.md", "body.md", "--no-glossary"],
    { ...process.env, XDG_CONFIG_HOME: room }, room);
  assert.equal(asDoc.status, 2, `doc() on an empty reply, twice:\n${asDoc.stderr}`);

  const asTranslate = await ranAsync(BIN, ["translate", "--kind", "doc", "--no-glossary", "Nothing here contrasts or negates anything."],
    { ...process.env, XDG_CONFIG_HOME: room }, room);
  assert.equal(asTranslate.status, 2, `translate --kind doc on the same failure, matching doc()'s own:\n${asTranslate.stderr}`);
  assert.match(asTranslate.stderr, /model returned nothing for this key/u, asTranslate.stderr);
});
