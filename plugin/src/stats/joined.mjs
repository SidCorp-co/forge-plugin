/* What joins a run to the work it did, off its own calls and never off the tracker; what each join
   claims and what it cannot: docs/cli/stats-the-eval.md. */

const CLAIMS = "forge claim";
const RULED = "forge codex verdict";
const PARKED = "forge record park";
const ADVANCES = "forge advance";

export const GRANTS = ["claim", "reclaim", "renewed", "take", "judged", "reconciled"];

/* Anchored, so the reference is what the line is ABOUT: `ISS-nn is claimed:` is the refusal and a
   caller's `--next` text prints behind `Next: `, so neither can fake an ownership. */
const OWNED = new RegExp(
  String.raw`^(?<ref>ISS-\d+|[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}) {2}(?:${GRANTS.join("|")}): `,
  "gimu",
);

export const claimedIn = (calls) => {
  const held = new Set();
  for (const call of calls) {
    if (call.class !== CLAIMS) continue;
    for (const found of String(call.body ?? "").matchAll(OWNED)) held.add(found.groups.ref.toUpperCase());
  }
  return [...held];
};

const PARKING = /--(?:park|drop)\b/u;

const span = (call) => ({ at: call.at, endedAt: call.endedAt });

/* An id is identity where a span is a guess, so the pairing tries this first. */
const OF = /--of[= \t]+(?<id>\S+)/u;

export const rulingsIn = (calls) => calls
  .filter((call) => call.class === RULED)
  .map((call) => ({ ...span(call), of: OF.exec(call.shell)?.groups.id ?? null }));

/* `forge advance --park` and `--drop` render the same record the record verb does. */
export const parkWritersIn = (calls) =>
  calls.filter((call) => call.class === PARKED || (call.class === ADVANCES && PARKING.test(call.shell))).map(span);

const soleIn = (entries, held, slack) => {
  if (held.of) {
    const named = entries.filter((one) => one.of === held.of);
    return named.length === 1 ? named[0] : null;
  }
  const near = entries.filter((one) => one.at >= held.at - slack && one.at <= held.endedAt + slack);
  return near.length === 1 ? near[0] : null;
};

export const pairedOneToOne = (spans, entries, slack = 0) => {
  const claims = new Map();
  for (const one of spans) {
    const found = soleIn(entries, one, slack);
    if (!found) continue;
    if (!claims.has(found)) claims.set(found, []);
    claims.get(found).push(one);
  }
  const pairs = [];
  for (const [entry, held] of claims) if (held.length === 1) pairs.push({ span: held[0], entry });
  const paired = new Set(pairs.map((one) => one.span));
  return { pairs, unpaired: spans.filter((span) => !paired.has(span)) };
};
