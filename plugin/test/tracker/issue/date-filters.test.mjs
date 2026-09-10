/* Spawned against a stub with a usable token, because the claim is that nothing was sent: a refusal
   read off a checkout with no endpoint would prove only that no credential was there to spend. The
   stub records one row per call, so the assertion is the call list's own length (ISS-1081). */
import assert from "node:assert/strict";
import test, { after } from "node:test";

import { fakeTracker, ranAsync } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const FLAGS = ["createdAfter", "createdBefore", "updatedAfter"];
const UNREADABLE = ["garbage", "not-a-date", "2026-13-01"];

/* `2026-01-01T00:00:00+07:00` is 2025-12-31T17:00Z, so the middle row sits between the two forms:
   an implementation reading the offset away lands on the date-only form's answer and fails. */
const DAY = "2026-01-01";
const OFFSET = "2026-01-01T00:00:00+07:00";
const STAMPS = ["2025-12-31T12:00:00.000Z", "2025-12-31T20:00:00.000Z", "2026-01-02T00:00:00.000Z"];

const issues = STAMPS.map((at, index) => ({
  documentId: `0000000${index + 1}-0000-4000-8000-000000000000`,
  issueId: `ISS-${index + 1}`,
  title: `row ${index + 1}`,
  status: "open",
  priority: "medium",
  createdAt: at,
  updatedAt: at,
}));

const state = { issues };
const tracker = await fakeTracker(state);
after(() => tracker.close());

const ran = (...argv) => ranAsync(FORGE, ["issue", ...argv], { ...tracker.env, FORGE_SESSION_ID: "date-filters" });
const keysIn = (text) => [...new Set(text.match(/ISS-\d+/gu) ?? [])].sort();

const spent = () => (state.calls ?? []).length;

test("a date this CLI cannot read is refused with nothing sent at all", async () => {
  for (const flag of FLAGS) {
    for (const word of UNREADABLE) {
      const before = spent();
      const { stdout, stderr, status } = await ran(`--${flag}`, word);
      const said = `${stdout}${stderr}`;
      assert.equal(status, 1, `--${flag} ${word} answered rather than refused: ${said}`);
      assert.match(said, new RegExp(`issue --${flag}`, "u"), `the refusal does not name --${flag}`);
      assert.ok(said.includes(word), `the refusal does not carry ${word}: ${said}`);
      assert.ok(said.includes(DAY), `the refusal shows no date form this CLI reads: ${said}`);
      assert.equal(spent(), before, `--${flag} ${word} spent a call before refusing`);
      assert.equal(keysIn(stdout).length, 0, `--${flag} ${word} printed rows: ${stdout}`);
    }
  }
});

/* Both forms of every flag, and the answers a correct reading gives: the date-only form opens its
   window at UTC midnight and the offset form seven hours earlier, so the two disagree by one row. */
const WINDOWS = {
  "createdAfter": { [DAY]: ["ISS-3"], [OFFSET]: ["ISS-2", "ISS-3"] },
  "createdBefore": { [DAY]: ["ISS-1", "ISS-2"], [OFFSET]: ["ISS-1"] },
  "updatedAfter": { [DAY]: ["ISS-3"], [OFFSET]: ["ISS-2", "ISS-3"] },
};

test("a date this CLI reads is not refused, and the rows that word selects are the rows printed", async () => {
  for (const [flag, forms] of Object.entries(WINDOWS)) {
    for (const [word, wanted] of Object.entries(forms)) {
      const { stdout, stderr, status } = await ran(`--${flag}`, word);
      assert.equal(status, 0, `--${flag} ${word} was refused: ${stdout}${stderr}`);
      assert.deepEqual(keysIn(stdout), wanted, `--${flag} ${word} selected the wrong rows`);
    }
  }
});
