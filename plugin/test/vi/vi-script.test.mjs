/* A word in a second script reached the tracker five times, from four writers, with every guard
   passing (ISS-412). The sightings below are the real strings, and the engine is driven with an
   answer that is foreign on the first ask and on both, so each gate is watched refusing. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { projectRecord, ranAsync } from "../fixtures.mjs";
import { gatewayOn } from "./fake-gateway.mjs";
import { translateItems } from "../../vi-natural/gateway/engine.mjs";
import * as script from "../../vi-natural/text/script.mjs";

const LAYER = new URL("../../src/tools/vi.mjs", import.meta.url);

/* English source, what the gateway stored, and the word the check has to name. */
const SIGHTINGS = [
  ["based on four facts read in the installed sources", "dựa trên bốn факt đọc được từ source đã cài", "факt"],
  ["the one way to bypass it", "cách duy nhất để обход qua.", "обход"],
  ["`meter-grade-lock.spec.ts` only. Three edits:", "`meter-grade-lock.spec.ts` בלבד. Ba chỗ chỉnh:", "בלבד."],
  ["This issue is about the entry unit and entry quantity", "Issue này **αφορά** đơn vị nhập và số lượng nhập.", "**αφορά**"],
  ["So either the screen writes the stock, or the case picks the wrong line.",
    "Vậy **либо** màn hình đang ghi kho, **либо** case đang chọn nhầm dòng.", "**либо**"],
];

test("each recorded sighting is refused, naming the word it was found in", () => {
  for (const [source, rendered, word] of SIGHTINGS) {
    const found = script.strays(source, rendered);
    assert.ok(found.length > 0, `refused: ${rendered}`);
    assert.equal(found[0].word, word, "the whole word is named, not only its foreign letters");
    assert.equal(found[0].index, rendered.indexOf(word), "at the offset it sits at in the rendering");
    assert.match(script.diff(source, rendered), new RegExp(`${JSON.stringify(word).replace(/[*.]/gu, "\\$&")} \\(\\w+\\) at offset ${found[0].index}`, "u"));
  }
});

test("the hybrid is one word and its script is named", () => {
  const [source, rendered] = SIGHTINGS[0];
  assert.deepEqual([..."факt"].map((one) => one.codePointAt(0) < 0x80), [false, false, false, true], "Cyrillic with a Latin t");
  assert.deepEqual(script.strays(source, rendered), [{ word: "факt", index: rendered.indexOf("факt"), script: "Cyrillic" }]);
});

test("Vietnamese passes in its decomposed spelling exactly as in its composed one", () => {
  const composed = "Vấn đề này liên quan đến đơn vị nhập và số lượng nhập";
  const decomposed = composed.normalize("NFD");
  assert.notEqual(decomposed, composed, "the NFD spelling carries combining marks the NFC one does not");
  assert.equal(script.diff("This is about the entry unit", composed), null);
  assert.equal(script.diff("This is about the entry unit", decomposed), null);
});

test("a non-Latin character the source carried passes, and one it did not is refused", () => {
  const source = "The Tokyo office (東京) signs it off";
  assert.equal(script.diff(source, "Văn phòng Tokyo (東京) ký duyệt"), null);
  assert.match(script.diff(source, "Văn phòng Tokyo (東京都) ký duyệt"), /"\(東京都\)" \(Han\)/u);
});

test("punctuation, digits, arrows, emoji and the block sentinel are storable in any rendering", () => {
  assert.equal(script.diff("plain", "Bước 1 → bước 2 — xong ✅ ⟦VI0⟧ «trích» 50%"), null);
});

/** A client answering each asked string with `reply(source, attempt)`, attempt counting from 1 per string. */
const clientFor = (reply) => {
  const attempts = new Map();
  return {
    asked: attempts,
    chat: async (system, user) => {
      const sent = JSON.parse(user.split("\n\n").at(-1));
      const stringOf = (value) => (typeof value === "string" ? value : value.s);
      return JSON.stringify(Object.fromEntries(Object.entries(sent).map(([key, held]) => {
        const source = stringOf(held);
        attempts.set(source, (attempts.get(source) ?? 0) + 1);
        return [key, reply(source, attempts.get(source))];
      })));
    },
  };
};

const [SOURCE, FOREIGN] = SIGHTINGS[0];
const CLEAN = "dựa trên bốn dữ kiện đọc được từ source đã cài";

test("a foreign word on the first ask is asked for once more, and the clean second answer is kept", async () => {
  const client = clientFor((source, attempt) => (attempt === 1 ? FOREIGN : CLEAN));
  const { results, problems } = await translateItems(client, [["1", SOURCE]]);
  assert.deepEqual([...results], [["1", CLEAN]], "the first answer never reaches the results");
  assert.deepEqual(problems, []);
  assert.equal(client.asked.get(SOURCE), 2, "the batch, then one second ask");
});

test("a foreign word on both asks is left out, with the word and its offset in the reason", async () => {
  const client = clientFor(() => FOREIGN);
  const { results, problems } = await translateItems(client, [["1", SOURCE]]);
  assert.equal(results.size, 0, "nothing of it is written");
  assert.equal(problems.length, 1);
  assert.match(problems[0].reason, new RegExp(`^rejected after retry: .*"факt" \\(Cyrillic\\) at offset ${FOREIGN.indexOf("факt")}`, "u"));
  assert.equal(client.asked.get(SOURCE), 2);
});

test("a caller's own verifier does not stand in for the script check", async () => {
  const client = clientFor(() => FOREIGN);
  const { results, problems } = await translateItems(client, [["1", SOURCE]], { verify: () => null });
  assert.equal(results.size, 0, "a verifier that finds nothing still leaves the foreign word out");
  assert.match(problems[0]?.reason ?? "", /"факt" \(Cyrillic\)/u);
});

test("a key exempt from the placeholder check is still held to the script on both asks", async () => {
  const client = clientFor(() => FOREIGN);
  const { results, problems } = await translateItems(client, [["1", SOURCE]], { skipVerify: new Set(["1"]) });
  assert.equal(results.size, 0);
  assert.match(problems[0]?.reason ?? "", /"факt" \(Cyrillic\)/u);
  assert.equal(client.asked.get(SOURCE), 2, "refused on the first ask, so asked again, and refused there too");
});

test("a rendering breaking both the caller's verifier and the script is refused with both named", async () => {
  const source = "four facts {count}";
  const client = clientFor(() => "bốn факt");
  const { problems } = await translateItems(client, [["1", source]]);
  assert.match(problems[0]?.reason ?? "", /missing \{count\}/u, "the placeholder diagnostic stands");
  assert.match(problems[0]?.reason ?? "", /"факt" \(Cyrillic\) at offset 4/u, "and the script one is not hidden behind it");
});

/** The layer every tracker write goes through, run for real against a gateway that answers `reply`. */
const layerWrites = async (t, reply, payload) => {
  const room = await gatewayOn(t, reply, "vi-script-");
  spawnSync("git", ["init", "-q", room], { cwd: room });
  projectRecord(room, room, { slug: "any", translate: "vi" });
  const call = `import("${LAYER.href}")`
    + `.then((m) => console.log(JSON.stringify(m.translated(${JSON.stringify(payload)}))))`;
  return ranAsync(process.execPath, ["-e", call], { ...process.env, HOME: room, XDG_CONFIG_HOME: room }, room);
};

for (const field of ["description", "title"]) {
  test(`a ${field} the gateway can only render with a foreign word is refused, and nothing is posted`, async (t) => {
    const run = await layerWrites(t, () => FOREIGN, { [field]: SOURCE });
    assert.equal(run.status, 1, `the write is refused:\n${run.stderr}`);
    assert.equal(run.stdout, "", "no payload leaves the layer to be sent");
    assert.match(run.stderr, /vi-natural could/u, "refused by the gateway's own exit");
    assert.match(run.stderr, /"факt" \(Cyrillic\)/u, `and the refusal names the word:\n${run.stderr}`);
  });
}

test("a field rendered clean on the second ask is posted as that rendering", async (t) => {
  let asked = 0;
  const run = await layerWrites(t, () => (asked++ === 0 ? FOREIGN : CLEAN), { description: SOURCE });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).description.trim(), CLEAN);
});
