/* The budget the tracker states on every answer, per scope the server names, so a fanning-out call
   waits for a window it has read rather than discovering it a hundred times over (ISS-1849). */

const SCOPE = "x-ratelimit-scope";
const LIMIT = "x-ratelimit-limit";
const REMAINING = "x-ratelimit-remaining";
const RESET = "x-ratelimit-reset";
const PAST_RESET_MS = 1000;

let scopes = new Map();
let routes = new Map();
let unknown = new Map();
let out = new Map();

const numbered = (headers, name) => {
  const said = headers?.get?.(name);
  const held = String(said ?? "").trim() === "" ? NaN : Number(said);
  return Number.isFinite(held) ? held : null;
};

/* What is out of this process right now, retired on every attempt however it ended, so an outage is
   not a debt later windows keep paying. A route no answer has placed counts against every scope. */
const inFlightIn = (scope) => [...out.entries()]
  .filter(([key]) => (routes.get(key) ?? scope) === scope)
  .reduce((sum, [, held]) => sum + held, 0);

/* A figure the server wrote before the calls still out of this process were counted. */
const lends = (remaining, scope) => Math.max(0, remaining - Math.max(0, inFlightIn(scope) - 1));

/* The tracker counts a call when it handles it, so a figure it states has counted every call it
   handled before the answer carrying it, whatever those answers are doing. Where this process is the
   whole of what that figure counts, the window does not need it: what it has admitted is what it
   admitted, and taking the calls still out off the stated figure charges them a second time
   (ISS-1947). Where something else is spending the credential, nothing here says which of this
   process's own calls the figure has reached, and the bound that assumes none of them is all there
   is. A call reserved before a reset may be charged after it, so what was outstanding at the
   adoption belongs to either window and is subtracted from both rather than credited to a sibling. */
const opened = (limit, remaining, resetAt, scope) => ({
  limit,
  remaining: limit - remaining <= inFlightIn(scope)
    ? Math.max(0, limit - inFlightIn(scope))
    : lends(remaining, scope),
  resetAt,
  mine: 0,
  borrowed: borrowedAt(scope),
  spanning: inFlightIn(scope),
  spent: 0,
  announced: false,
});

/* Attribution alone: what a window charged them is the server's figure to say and not this one's. */
const charge = (held, carried) => {
  held.spanning += carried;
};

/* What a window may be charged for beyond its own reservations, by the route that sent it: what was
   out when the window opened, and what a route joining it later brings. Per route and not a running
   total, because a route outstanding at the adoption is in both and adding it twice closes a window
   that owes nothing. What has already come back was charged where it was sent, and a window since
   opened owes it nothing — which is why this is not the attribution counter above. */
const borrowedAt = (scope) => new Map([...out.entries()]
  .filter(([key]) => (routes.get(key) ?? scope) === scope && (out.get(key) ?? 0) > 0));

const borrow = (held, key, carried) => {
  held.borrowed.set(key, Math.max(held.borrowed.get(key) ?? 0, Math.min(carried, out.get(key) ?? 0)));
};

/* Every call this window has to answer for: its own reservations, and what it borrowed by route. A
   route no answer has placed is in that borrowing where it was out at the adoption and not where it
   went afterwards, there being nothing yet to attribute it to. Left out, such a call reads as a
   sibling's and the window takes the bound, which is the safe way to be wrong about it. */
const ourOwn = (held) => held.mine
  + [...held.borrowed.values()].reduce((sum, one) => sum + one, 0);

/* At least this much of the window went to something else on this credential. Above zero is a
   sibling; a zero is not proof of none, which is the reading this is admitted on and the risk the
   decision on ISS-1947 records. */
const elsewhereIn = (held) => Math.max(0, held.spent - ourOwn(held));

export const sawBudget = (key, headers) => {
  const scope = headers?.get?.(SCOPE);
  const [limit, remaining, reset] = [LIMIT, REMAINING, RESET].map((name) => numbered(headers, name));
  if (!scope || limit === null || remaining === null || reset === null) return;
  const carried = key && !routes.has(key) ? (unknown.get(key) ?? 0) : 0;
  const returned = Math.max(0, carried - (out.get(key) ?? 0));
  if (key) {
    routes.set(key, scope);
    unknown.delete(key);
  }
  const resetAt = reset * 1000;
  const held = scopes.get(scope);
  /* The reading is a window already past and says nothing of this one; the calls behind it are this
     process's either way, and dropping them with the reading is how they become somebody else's. */
  if (held && resetAt < held.resetAt) return charge(held, carried);
  const now = !held || resetAt > held.resetAt ? opened(limit, remaining, resetAt, scope) : held;
  charge(now, now === held ? carried : returned);
  if (now === held) borrow(now, key, carried);
  scopes.set(scope, now);
  now.limit = limit;
  now.spent = Math.max(now.spent, limit - remaining);
  /* The window's own count where it answers for the whole figure, and downward only where it does
     not: a header written before the calls in flight were counted overstates what is left. */
  if (now === held) {
    now.remaining = Math.min(now.remaining, elsewhereIn(now) === 0
      ? Math.max(0, limit - ourOwn(now))
      : lends(remaining, scope));
  }
};

/* Sent against a route no answer has placed: charged to every window, there being no telling which. */
const unattributed = () => [...unknown.values()].reduce((sum, one) => sum + one, 0);

const wentSaid = (held, scope) => {
  const elsewhere = Math.max(0, held.spent - held.mine - held.spanning - unattributed());
  return `Forge paced itself: the ${scope} budget of ${held.limit} is spent for this window`
    + (elsewhere > 0 ? `, at least ${elsewhere} of it by something else on this credential` : "")
    + "; waiting ";
};

export const reserveIn = (key, now, within = Infinity) => {
  const held = scopes.get(routes.get(key));
  const went = () => {
    out.set(key, (out.get(key) ?? 0) + 1);
    if (!held) unknown.set(key, (unknown.get(key) ?? 0) + 1);
    return null;
  };
  if (!held) return went();
  /* The window read is over and the next unknown, so the call goes and its answer opens that one. */
  if (now > held.resetAt) return went();
  if (held.remaining > 0) {
    held.remaining -= 1;
    held.mine += 1;
    return went();
  }
  const seconds = Math.max(0, (held.resetAt + PAST_RESET_MS - now) / 1000);
  /* The bound handed down is all this may spend: past it the call goes and meets what it would have. */
  if (seconds * 1000 > within) return went();
  const said = held.announced ? null : `${wentSaid(held, routes.get(key))}${Math.ceil(seconds)}s for `
    + "the reset the tracker named, rather than sending calls it would refuse.";
  held.announced = true;
  return { seconds, said };
};

export const settled = (key) => out.set(key, Math.max(0, (out.get(key) ?? 0) - 1));

export const unpredictedIn = (key) => {
  const scope = routes.get(key);
  return scope
    ? `on the ${scope} budget, which the reading it was paced against did not predict`
    : "having read no budget from this tracker to pace against";
};

export const pacedBy = (key) => {
  const scope = routes.get(key);
  const held = scopes.get(scope);
  return held ? `the ${scope} budget of ${held.limit} a window` : null;
};

export const forgetBudget = () => {
  scopes = new Map();
  routes = new Map();
  unknown = new Map();
  out = new Map();
};
