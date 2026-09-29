/* A comment reached the tracker holding `⟦VI⟧` where words had been: its block had no inline code,
   so the sentinel sets compared were both empty (ISS-1016). Each case runs the verb a caller spawns,
   against a local gateway answering with the text the model gave, since what failed was the body
   that verb wrote and not a function's return. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ranAsync } from "../fixtures.mjs";
import { gatewayOn } from "./fake-gateway.mjs";

const BUNDLED = fileURLToPath(new URL("../../bin/vi-natural", import.meta.url));
const INVENTED = "Từ giờ, hãy dẫn ⟦VI⟧ ở cột bên phải.";

/** `vi-natural doc` over one document, every block answered with `reply` of what was sent. */
const docWith = async (t, source, reply) => {
  const room = await gatewayOn(t, reply, "vi-marker-");
  writeFileSync(join(room, "body.md"), source);
  const run = await ranAsync(BUNDLED, ["doc", "-o", "body.vi.md", "body.md", "--no-glossary"],
    { ...process.env, XDG_CONFIG_HOME: room }, room);
  return { ...run, written: readFileSync(join(room, "body.vi.md"), "utf8") };
};

test("a block with no inline code whose translation invents ⟦VI⟧ keeps its English and fails the run", async (t) => {
  const source = "Cite the right-hand column from here on.\n";
  const run = await docWith(t, source, () => INVENTED);
  assert.equal(run.status, 2, `a block left in English is the code a caller reads:\n${run.stderr}`);
  assert.equal(run.written, source, "the body written holds the English, and no marker");
  assert.match(run.stderr, /block 0: .*marker-shaped token ⟦VI⟧ is no placeholder this block was given/u,
    "the refusal names the block and the token it invented");
});

test("a lone bracket belonging to no placeholder and no fence is refused the same way", async (t) => {
  for (const reply of ["Từ giờ, hãy dẫn ⟦ cột bên phải.", "Từ giờ, hãy dẫn cột ⟧ bên phải."]) {
    const run = await docWith(t, "Cite the right-hand column from here on.\n", () => reply);
    assert.equal(run.status, 2, `${reply}\n${run.stderr}`);
    assert.match(run.stderr, /marker-shaped token [⟦⟧] is no placeholder/u, reply);
  }
});

test("the tracker's untrusted-data fences still pass, as the markers a body legitimately carries", async (t) => {
  const source = "⟦UNTRUSTED_DATA from the tracker⟧\nThe body the tracker sent.\n⟦END_UNTRUSTED_DATA⟧\n";
  const translated = "⟦UNTRUSTED_DATA from the tracker⟧\nNội dung tracker gửi về.\n⟦END_UNTRUSTED_DATA⟧";
  const run = await docWith(t, source, () => translated);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.written, `${translated}\n`);
});

test("a sentinel the protector minted still passes and comes back as its code span", async (t) => {
  const sent = [];
  const run = await docWith(t, "Run `npm test` before you push.\n", (block) => {
    sent.push(block);
    return "Chạy ⟦VI0⟧ trước khi đẩy lên.";
  });
  assert.deepEqual(sent, ["Run ⟦VI0⟧ before you push."], "the span went out as its sentinel");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.written, "Chạy `npm test` trước khi đẩy lên.\n");
});

/* The route every tracker title takes: `src/tools/vi.mjs` sends it through `translate --kind doc`,
   whose prompt names the same markers. Its exit code is `doc`'s own for this class of rejection
   (ISS-1752): a block a verifier rejected twice, whichever of the two commands carries it. */
test("a string translated as doc that comes back holding an invented ⟦VI⟧ is refused", async (t) => {
  const room = await gatewayOn(t, () => INVENTED, "vi-marker-title-");
  const run = await ranAsync(BUNDLED, ["translate", "--kind", "doc", "--no-glossary", "Cite the right-hand column"],
    { ...process.env, XDG_CONFIG_HOME: room }, room);
  assert.equal(run.status, 2, `refused, so the caller posts nothing:\n${run.stdout}${run.stderr}`);
  assert.equal(run.stdout, "", "and no translation reaches stdout");
  assert.match(run.stderr, /marker-shaped token ⟦VI⟧/u);
});
