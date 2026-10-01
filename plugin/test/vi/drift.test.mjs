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

import { ranAsync } from "../fixtures.mjs";
import { gatewayOn, translatedIn } from "./fake-gateway.mjs";
import { diff } from "../../vi-natural/text/drift.mjs";
import { translateItems } from "../../vi-natural/gateway/engine.mjs";
import { CONTRAST_VI_WORDS, NEGATION_VI_WORDS, UNCOUNTED_CONTRAST_VI_WORDS } from "../../vi-natural/vi-text.mjs";

const BIN = fileURLToPath(new URL("../../bin/vi-natural", import.meta.url));

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

test("the write boundary refuses a field whose rewrite drops the source's contrast, before anything posts", async (t) => {
  const source = "Store the balance as negative rather than as one somebody has signed.";
  const run = await translatedIn(t, () => "Lưu số dư dưới dạng âm và cũng gọi là số có dấu.",
    { description: source }, "vi-drift-write-");
  assert.equal(run.status, 1, `the field's own drift refuses the whole write:\n${run.stderr}`);
  assert.match(run.stderr, /vi-natural could/u, run.stderr);
  assert.match(run.stderr, /contrasts one reading against another/u,
    `the reason vi-natural gave reaches the run, not only a block count:\n${run.stderr}`);
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

/* Criterion 5: the title's own path rejects a drift the same way `doc` does, not only a structural
   rejection (vi-marker.test.mjs) or a non-verify one (the case just above). */
test("translate --kind doc rejects a dropped-contrast candidate the same way vi-natural doc does", async (t) => {
  const room = await gatewayOn(t, () => "Lưu số dư dưới dạng âm và cũng gọi là số có dấu.", "vi-drift-translate-");
  const run = await ranAsync(BIN, ["translate", "--kind", "doc", "--no-glossary",
    "Store the balance as negative rather than as one somebody has signed."],
    { ...process.env, XDG_CONFIG_HOME: room }, room);
  assert.equal(run.status, 2, `the title path rejects the same drift doc() would:\n${run.stderr}`);
  assert.equal(run.stdout, "", "no rewrite reaches stdout");
  assert.match(run.stderr, /contrasts one reading against another/u, run.stderr);
});

/* ISS-2098: a source already in Vietnamese matches none of the English patterns above, so a rewrite
   that kept one "chưa" of the two it was given posted at exit 0 with the claim inverted. The pair is
   the issue's own, typed and stored. */
const TYPED = "Thẻ Giá trị vật tư ở kỳ chưa công việc nào tra tới bước định mức nay nói rõ chưa kể được mã hiệu nào cần bổ sung, thay vì vừa bảo đi bổ sung vừa ghi con số 0.";
const STORED = "Thẻ Giá trị vật tư ở kỳ chưa có công việc nào tra đến bước định mức giờ nêu rõ mã hiệu cần bổ sung, thay vì vừa yêu cầu bổ sung vừa hiển thị số 0.";
const LOST = /the source carries 3 Vietnamese negation or contrast marker\(s\) .* and the rewrite carries 2/u;

test("drift.diff: a Vietnamese rewrite that keeps fewer negations than its source is named with both counts", () => {
  const found = diff(TYPED, STORED);
  assert.match(found, LOST, found);
});

test("the write boundary refuses a Vietnamese release note whose rewrite drops one of its negations, before anything posts", async (t) => {
  const run = await translatedIn(t, () => STORED, { releaseNotes: { section: "Fixed", userFacing: TYPED } }, "vi-drift-note-");
  assert.equal(run.status, 1, `the note's own drift refuses the whole write:\n${run.stderr}`);
  assert.equal(run.stdout, "", "no payload reaches the tracker call");
  assert.match(run.stderr, /nothing was posted/u, run.stderr);
  assert.match(run.stderr, LOST, `the refusal names both counts:\n${run.stderr}`);
});

test("vi-natural doc keeps a Vietnamese block whose rewrite drops a negation as it was sent and exits 2", async (t) => {
  const run = await docWith(t, `${TYPED}\n`, () => `${STORED}\n`, "vi-drift-doc-vi-");
  assert.equal(run.status, 2, run.stderr);
  assert.equal(readFileSync(run.path, "utf8"), `${TYPED}\n`, "the file kept the text as it was sent");
  assert.match(run.stderr, LOST, run.stderr);
});

test("translate --kind doc refuses a Vietnamese title whose rewrite drops a negation", async (t) => {
  const room = await gatewayOn(t, () => STORED, "vi-drift-translate-vi-");
  const run = await ranAsync(BIN, ["translate", "--kind", "doc", "--no-glossary", TYPED],
    { ...process.env, XDG_CONFIG_HOME: room }, room);
  assert.equal(run.status, 2, run.stderr);
  assert.equal(run.stdout, "", "no rewrite reaches stdout");
  assert.match(run.stderr, LOST, run.stderr);
});

test("the write boundary posts a Vietnamese rewrite that keeps each negation in other words", async (t) => {
  const source = "Kỳ này chưa có công việc nào tra tới bước định mức.";
  const kept = "Kỳ này không có công việc nào tra đến bước định mức.";
  assert.equal(diff(source, kept), null);
  const run = await translatedIn(t, () => kept, { releaseNotes: { section: "Fixed", userFacing: source } }, "vi-drift-note-ok-");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).releaseNotes.userFacing, kept);
});

test("drift.diff: a compound that opens with a negation word and negates nothing may be dropped", () => {
  const pairs = [
    ["Thêm cột mới, chẳng hạn cột đơn giá.", "Thêm cột mới, ví dụ cột đơn giá."],
    ["Báo lỗi khi không gian lưu trữ đầy.", "Báo lỗi khi bộ nhớ đầy."],
    ["Forge không chỉ theo dõi issue mà còn ghi kết quả.", "Forge theo dõi issue và ghi kết quả."],
    ["Đây không phải lỗi cấu hình mà là lỗi mạng.", "Đây là lỗi mạng."],
    ["Bạn đã lưu thay đổi chưa?", "Bạn đã lưu thay đổi?"],
    ["Có lưu bản nháp không?", "Lưu bản nháp?"],
    ["Bản cập nhật không xóa dữ liệu và không đổi cấu hình.", "Bản cập nhật không xóa dữ liệu hay đổi cấu hình."],
    ["Không có cấu hình nên không kết nối được máy chủ.", "Thiếu cấu hình nên không kết nối được máy chủ."],
  ];
  for (const [source, rewrite] of pairs) assert.equal(diff(source, rewrite), null, `${source} → ${rewrite}`);
});

test("drift.diff: a second, different negation after a coordinator is still demanded", () => {
  const found = diff("Bản cập nhật không xóa dữ liệu và chưa gửi thông báo.", "Bản cập nhật không xóa dữ liệu và gửi thông báo.");
  assert.match(found, /the source carries 2 Vietnamese negation or contrast marker\(s\) .* and the rewrite carries 1/u, found);
});

test("drift.diff: a Vietnamese contrast dropped with no negation in its place is named", () => {
  const found = diff("Lưu số dư âm thay vì gọi là số có dấu.", "Lưu số dư âm và gọi là số có dấu.");
  assert.match(found, /the source carries 1 Vietnamese negation or contrast marker\(s\) .* and the rewrite carries 0/u, found);
});

test("drift.diff: a Vietnamese contrast traded for a negation, or back, is not flagged", () => {
  assert.equal(diff("Thay vì chọn A, chọn B.", "Không chọn A mà chọn B."), null);
  assert.equal(diff("Không chọn A mà chọn B.", "Chọn B thay vì A."), null);
  assert.equal(diff("Chọn B chứ không chọn A.", "Chọn B thay vì A."), null, "chứ không is one marker, not a contrast and a negation");
  assert.equal(diff("Chọn B thay vì A.", "Không phải chọn A mà là chọn B."), null, "a paired opener the rewrite introduces is credited");
});

test("drift.diff: a capitalised Vietnamese marker opening a sentence is recognised as one", () => {
  assert.equal(diff("Do not enable this without confirmation.", "Không bật tính năng này khi thiếu xác nhận."), null);
  assert.equal(diff("Store the balance rather than sign it.", "Thay vì ký, hãy lưu số dư."), null);
  assert.equal(diff("Không bật tính năng này.", "không bật tính năng này."), null);
});

/* One list per family in vi-text.mjs feeds both readings, so a word added there is held by both. */
test("every Vietnamese marker vi-text.mjs lists is recognised by both readings", () => {
  const uncounted = new Set(UNCOUNTED_CONTRAST_VI_WORDS.split(", "));
  for (const word of NEGATION_VI_WORDS.split(", ")) {
    assert.equal(diff("Do not enable this.", `Bật ${word} tính năng này.`), null, `presence: ${word}`);
    assert.ok(diff(`Bật ${word} tính năng này.`, "Bật tính năng này."), `count: ${word}`);
  }
  for (const word of CONTRAST_VI_WORDS.split(", ")) {
    assert.equal(diff("Keep A rather than B.", `Giữ A ${word} B.`), null, `presence: ${word}`);
    const drop = diff(`Giữ A ${word} B.`, "Giữ A và B.");
    if (uncounted.has(word)) assert.equal(drop, null, `left out of the count: ${word}`);
    else assert.ok(drop, `count: ${word}`);
  }
});
