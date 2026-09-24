/* What joins a run to the work it did, off its own calls and never off the tracker; what each join
   claims and what it cannot: docs/cli/stats-the-eval.md. */
import { ASKED, WORKTREE } from "../resolve/config.mjs";
import { idGrantedBy, movesTheId } from "../resolve/session/granted-id.mjs";
import { CLAIM_CLASS } from "./corpus/classes.mjs";

const RULED = "forge codex verdict";
const PARKED = "forge record park";
const ADVANCES = "forge advance";

export const GRANTS = ["claim", "unheld", "reclaim", "renewed", "take", "handed", "judged", "reconciled"];

/* Anchored, so the reference is what the line is ABOUT: `ISS-nn is claimed:` is the refusal and a
   caller's `--next` text prints behind `Next: `, so neither can fake an ownership. */
const GRANTED = String.raw`^(?<ref>ISS-\d+|[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}) {2}(?:${GRANTS.join("|")}): `;
const OWNED = new RegExp(GRANTED, "gimu");
/* The same line read for the holder it names and the source the claim read it from, which a line printed before claims said one leaves empty. */
const HELD = new RegExp(String.raw`${GRANTED}session (?<id>\S+) \((?:id from (?<source>[a-z]+); )?`, "gimu");

export const claimedIn = (calls) => {
  const held = new Set();
  for (const call of calls) {
    if (call.class !== CLAIM_CLASS) continue;
    for (const found of String(call.body ?? "").matchAll(OWNED)) held.add(found.groups.ref.toUpperCase());
  }
  return [...held];
};

const PARKING = /--(?:park|drop)\b/u;

const span = (call) => ({ at: call.at, endedAt: call.endedAt });

/* An id is identity where a span is a guess, so the pairing tries this first. */
const OF = /--of[= \t]+(?<id>\S+)/u;

/* The two sources that name one run; every other one names a wave, a machine or nothing, and claims no ruling for anybody. */
const OWN = new Set([ASKED, WORKTREE]);

/* The id a run's own claims printed, which a call of that run resolves as well unless its text moves it: one id, read under a source naming a run by a claim whose text moved nothing, and none where the claims printed two. */
const claimedRun = (calls) => {
  const printed = new Set();
  const own = new Set();
  for (const call of calls) {
    if (call.class !== CLAIM_CLASS) continue;
    const moved = movesTheId(call.command ?? "");
    for (const found of String(call.body ?? "").matchAll(HELD)) {
      printed.add(found.groups.id);
      if (!moved && OWN.has(found.groups.source)) own.add(found.groups.id);
    }
  }
  return printed.size === 1 && own.size === 1 ? [...own][0] : null;
};

/* The run a ruling call's own text grants the `forge` process, read by the reader a live call is judged by, so a text naming two ids or taking one back names none; a text that moves nothing is its run's, as the claims printed it. */
export const rulingsIn = (calls) => {
  const claimed = claimedRun(calls);
  return calls
    .filter((call) => call.class === RULED)
    .map((call) => {
      const command = call.command ?? "";
      const run = idGrantedBy(command) ?? (movesTheId(command) ? null : claimed);
      return { ...span(call), of: OF.exec(call.shell)?.groups.id ?? null, run };
    });
};

/* `forge advance --park` and `--drop` render the same record the record verb does. */
export const parkWritersIn = (calls) =>
  calls.filter((call) => call.class === PARKED || (call.class === ADVANCES && PARKING.test(call.shell))).map(span);

const ownRun = (entry) => (OWN.has(entry.runFrom) ? entry.run ?? null : null);

const reached = (entries, held, slack) => (held.of
  ? entries.filter((one) => one.of === held.of)
  : entries.filter((one) => one.at >= held.at - slack && one.at <= held.endedAt + slack));

/* A call with a run of its own claims the one entry that run wrote among those it reaches, and otherwise what the clock alone would give it, save an entry some other run wrote; a call with none claims what the clock alone gives. */
const claimOf = (entries, held, slack) => {
  const near = reached(entries, held, slack);
  if (held.run) {
    const named = near.filter((one) => ownRun(one) === held.run);
    if (named.length) return named.length === 1 ? { entry: named[0], named: true } : null;
  }
  if (near.length !== 1) return null;
  const mine = ownRun(near[0]);
  return held.run && mine && mine !== held.run ? null : { entry: near[0], named: false };
};

/* One named claim takes its entry over every unnamed one, two named claims leave it to neither, and with none named the one claimant takes it or nobody does. */
const winnerOf = (claims) => {
  const named = claims.filter((one) => one.named);
  if (named.length) return named.length === 1 ? named[0].span : null;
  return claims.length === 1 ? claims[0].span : null;
};

export const pairedOneToOne = (spans, entries, slack = 0) => {
  const claims = new Map();
  for (const one of spans) {
    const found = claimOf(entries, one, slack);
    if (!found) continue;
    if (!claims.has(found.entry)) claims.set(found.entry, []);
    claims.get(found.entry).push({ span: one, named: found.named });
  }
  const pairs = [];
  for (const [entry, held] of claims) {
    const won = winnerOf(held);
    if (won) pairs.push({ span: won, entry });
  }
  const paired = new Set(pairs.map((one) => one.span));
  return { pairs, unpaired: spans.filter((span) => !paired.has(span)) };
};
