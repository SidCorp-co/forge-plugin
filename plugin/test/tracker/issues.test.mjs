/* A human reference is resolved by searching the offsets of the set ordered oldest first, and the
   whole set is read by paging that same order — so what is judged here is the arithmetic on both:
   how many requests a key costs, and that a walk ends where the route says there is nothing behind. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../fixtures.mjs";

/* Imported after the endpoint is written, because `resolve/config.mjs` resolves its path on load. */
const HOME = tempRoom("issues-home-");
mkdirSync(join(HOME, "forge"));
writeFileSync(
  join(HOME, "forge", "config.json"),
  JSON.stringify({ url: "https://stub.example/mcp", token: "t" }),
);
process.env.XDG_CONFIG_HOME = HOME;

const row = (number) => ({
  id: `u-${number}`,
  displayId: `ISS-${number}`,
  status: "open",
  priority: "medium",
  createdAt: `2026-01-${String(number).padStart(2, "0")}T00:00:00.000Z`,
  title: `issue ${number}`,
});

/* The set the stub serves, and how many rows one request of it carries. A case replaces both. */
let SET = [row(1), row(2)];
let FITS = 200;
const asked = [];

const paged = (url) => {
  const query = url.searchParams;
  const offset = Number(query.get("offset") ?? 0);
  const limit = Math.min(Number(query.get("limit") ?? 200), FITS);
  const rows = query.get("sort") === "createdAt:asc" ? SET : [...SET].reverse();
  const filtered = rows.filter((one) => !query.get("status") || one.status === query.get("status"));
  const page = filtered.slice(offset, offset + limit);
  return {
    items: page,
    returned: page.length,
    total: filtered.length,
    limit,
    offset,
    hasMore: offset + page.length < filtered.length,
  };
};

globalThis.fetch = async (address) => {
  const url = new URL(address);
  asked.push({ path: url.pathname, query: Object.fromEntries(url.searchParams) });
  const body = url.pathname === "/api/projects"
    ? [{ id: "p-1", slug: "forge-plugin" }]
    : paged(url);
  return { ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify(body) };
};

const { DATE_FILTERS, documentIdOf, everyIssue, keeps, queued } = await import("../../src/tracker/issues.mjs");

const lookups = () => asked.filter((one) => one.query.limit === "1").length;
const pages = () => asked.filter((one) => one.query.limit !== "1" && one.path.endsWith("/issues")).length;

test("a uuid is its own answer and asks for no list", async () => {
  const uuid = "56d4641e-fd47-4a80-b468-2c602265ce85";
  asked.length = 0;
  assert.equal(await documentIdOf(uuid), uuid);
  assert.equal(asked.length, 0);
});

/* The order the page is worked in, which the tracker has no argument for: its list answers in the
   order things were last touched, so a queue is the CLI's to impose on what arrived. */
const ORDER = ["critical", "high", "medium", "low", "none"];
const at = (priority, createdAt, issueId = priority) => ({ issueId, priority, createdAt });
const keys = (rows, order = ORDER) => queued(rows, order).map((one) => one.issueId);

test("the rank comes first, in the order the tracker's own set declares", () => {
  const rows = [at("low", "2026-01-01"), at("critical", "2026-01-01"), at("medium", "2026-01-01")];
  assert.deepEqual(keys(rows), ["critical", "medium", "low"]);
});

/* The value a filing nobody ranked carries is the last of the tracker's own set, so what nobody has
   weighed sits under what somebody called low and the top of the browse is workable (ISS-334). */
test("an unranked filing sorts under every issue somebody called low", () => {
  const rows = [at("none", "2026-01-01"), at("low", "2026-02-01"), at("medium", "2026-03-01")];
  assert.deepEqual(keys(rows), ["medium", "low", "none"], "and the older `none` still goes last");
});

test("at one rank the oldest is first, because it has waited longest", () => {
  const rows = [
    at("high", "2026-03-01", "new"),
    at("high", "2026-01-01", "old"),
    at("high", "2026-02-01", "middle"),
  ];
  assert.deepEqual(keys(rows), ["old", "middle", "new"]);
});

test("a rank the set does not hold sorts behind every rank it does", () => {
  const rows = [at("archived", "2026-01-01", "odd"), at("none", "2026-02-01", "none")];
  assert.deepEqual(keys(rows), ["none", "odd"]);
});

/* A row with no date claims no place: the back of its own rank rather than the front, where an
   unreadable timestamp read as the epoch would have put it. */
test("a row with no timestamp takes the back of its rank and keeps the page it arrived in", () => {
  const rows = [{ issueId: "undated", priority: "high" }, at("high", "2026-05-01", "dated")];
  assert.deepEqual(keys(rows), ["dated", "undated"]);
});

test("a declaration carrying no set leaves the page exactly as it arrived", () => {
  const rows = [at("low", "2026-01-01"), at("critical", "2026-01-01")];
  assert.deepEqual(keys(rows, []), ["low", "critical"]);
  assert.deepEqual(queued(rows, []), rows, "and the rows themselves are the ones handed in");
});

/* Where nothing below a key was removed, its number is the offset it sits at, and the arithmetic is
   what makes the lookup one request rather than a walk of the backlog. */
const WHOLE = Array.from({ length: 40 }, (unused, index) => row(index + 1));

test("a key on a backlog with no gaps costs one request, whatever page it would be on", async () => {
  SET = WHOLE;
  FITS = 2;
  asked.length = 0;
  assert.equal(await documentIdOf("ISS-37"), "u-37");
  assert.equal(lookups(), 1, `${lookups()} request(s) for a key nineteen pages down`);
});

/* Rows deleted below the key move the answer earlier than its number, which is the case the search
   exists for; it has to end, and to cost less than reading the backlog. */
const GAPPED = [row(2), row(5), row(11), row(12), row(30)];

test("a key with rows deleted below it is found by searching the offsets", async () => {
  SET = GAPPED;
  FITS = 200;
  asked.length = 0;
  assert.equal(await documentIdOf("ISS-30"), "u-30");
  assert.ok(lookups() > 1, "the offset the key implies was past the end");
  assert.ok(lookups() <= GAPPED.length, `${lookups()} request(s) for ${GAPPED.length} rows`);
});

/* A key nothing holds exits the process rather than throwing, so both refusals are judged where a
   refusal can be read — `plugin/test/cli/reference-lookup.test.mjs`, which spawns the verb. */

test("the whole set is paged to the end, however many pages that takes", async () => {
  SET = WHOLE;
  FITS = 7;
  asked.length = 0;
  const read = await everyIssue({ status: "open" });
  assert.equal(read.rows.length, WHOLE.length);
  assert.equal(read.whole, true);
  assert.equal(pages(), Math.ceil(WHOLE.length / FITS));
});

/* On a module that has walked nothing yet, so the pair meets at page one rather than at a walk
   already finished: an offset read off the count already read lets two readers ask one page twice,
   step over the next, and hand back a set short by that page with `whole` true on it. */
test("two readers starting one walk together read every page of it, not every other one", async () => {
  SET = WHOLE;
  FITS = 7;
  asked.length = 0;
  const fresh = await import(`../../src/tracker/issues.mjs?walk=${Date.now()}`);
  const [one, two] = await Promise.all([
    fresh.everyIssue({ status: "open" }),
    fresh.everyIssue({ status: "open" }),
  ]);
  for (const read of [one, two]) {
    assert.equal(read.rows.length, WHOLE.length, `a reader was handed ${read.rows.length} of ${WHOLE.length}`);
    assert.equal(read.whole, true);
  }
  assert.equal(pages(), Math.ceil(WHOLE.length / FITS), "and the pair paid for one walk between them");
});

test("two readers of one ask share the walk, and a second ask is walked on its own", async () => {
  SET = WHOLE;
  FITS = 7;
  asked.length = 0;
  const [one, two] = await Promise.all([everyIssue({ status: "open" }), everyIssue({ status: "open" })]);
  assert.equal(one.rows.length, two.rows.length);
  const shared = pages();
  await everyIssue({ status: "closed" });
  assert.ok(pages() > shared, "a different ask is a different walk");
});

/* The five filters the route does not narrow on are applied to the rows that came back, so the
   browse verb keeps every flag it took. */
test("a filter the route does not serve is applied to the page it answered with", () => {
  assert.equal(keeps({ status: "open" }, { statusNot: "closed" }), true);
  assert.equal(keeps({ status: "closed" }, { statusNot: "closed" }), false);
  assert.equal(keeps({ complexity: "fix" }, { complexity: "fix" }), true);
  assert.equal(keeps({ complexity: "s" }, { complexity: "fix" }), false);
});

test("a date filter reads the row's own stamp, and an undated row is outside every window", () => {
  const dated = { createdAt: "2026-02-01T00:00:00.000Z" };
  assert.equal(keeps(dated, { createdAfter: "2026-01-01T00:00:00.000Z" }), true);
  assert.equal(keeps(dated, { createdAfter: "2026-03-01T00:00:00.000Z" }), false);
  assert.equal(keeps(dated, { createdBefore: "2026-03-01T00:00:00.000Z" }), true);
  assert.equal(keeps({}, { createdAfter: "2026-01-01T00:00:00.000Z" }), false);
});

/* The two paths a per-row check misses are why this one is at the entry: a filter that
   short-circuits ahead of the date, and a page with no row to reach it (codex F1). */
test("a date the walk cannot read is refused before it reads a row, so a filter added without a judge fails rather than answers", async () => {
  const { refusing } = await import("../../src/resolve/settings.mjs");
  assert.deepEqual(DATE_FILTERS, ["createdAfter", "createdBefore", "updatedAfter"],
    "the date-shaped local filters are no longer the three this case covers");
  const held = SET;
  await refusing(async () => {
    /* The empty page and the nonempty one, because a guard placed after the fetch passes on rows
       alone; and no request in either, which is what says it ran before the page (codex F1). */
    for (const [word, rows] of [["garbage", held], ["not-a-date", []]]) {
      SET = rows;
      for (const name of DATE_FILTERS) {
        const spent = asked.length;
        await assert.rejects(() => everyIssue({ [name]: word }),
          new RegExp(`A date filter reached the walk unjudged: --${name} is ${word}`, "u"),
          `${name} narrowed on a word nothing read over ${rows.length} row(s)`);
        assert.equal(asked.length, spent, `${name} sent a request before refusing`);
      }
    }
    SET = held;
    await assert.rejects(() => everyIssue({ statusNot: "open", createdAfter: "not-a-date" }),
      /--createdAfter is not-a-date/u, "a filter ahead of the date short-circuited past the refusal");
  });
});

test("a filter nothing here applies leaves every row standing", () => {
  assert.equal(keeps({ status: "open" }, { status: "open" }), true);
  assert.equal(keeps({ status: "open" }, {}), true);
});
