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
let unmetered = new Map();

const numbered = (headers, name) => {
  const said = headers?.get?.(name);
  const held = String(said ?? "").trim() === "" ? NaN : Number(said);
  return Number.isFinite(held) ? held : null;
};

const summed = (counts, scope) => [...counts.entries()]
  .filter(([key]) => (routes.get(key) ?? scope) === scope)
  .reduce((sum, [, held]) => sum + held, 0);

/* What is out of this process right now, retired on every attempt however it ended, so an outage is
   not a debt later windows keep paying. A route no answer has placed counts against every scope. */
const inFlightIn = (scope) => summed(out, scope);

/* Of those, the ones no window took off its own allowance: a call that took a pass-through branch.
   The rest were charged when they went, so a reading that subtracts them from the server's figure as
   well charges them twice (ISS-1947). */
const unmeteredIn = (scope) => summed(unmetered, scope);

/* Which of a route's outstanding calls an answer belongs to is nothing a count per route can say, so
   the attempt carries its own: a count that guessed would hold a pass-through's debt after it is
   home, and a route under steady load would never retire one at all. */
const passedThrough = (taken) => (taken?.charged === false ? 1 : 0);

/* A figure the server wrote before the calls out of this process were counted, less the one this
   answer belongs to where it is one of them: the tracker counts a call when it handles it, so the
   figure carrying an answer has counted that answer's own call already. */
const lends = (remaining, outstanding, own) =>
  Math.max(0, remaining - Math.max(0, outstanding - own));

/* A call reserved before a reset may be charged after it, so what was outstanding at the adoption
   belongs to either window and is subtracted from both rather than credited to a sibling. */
const opened = (limit, remaining, resetAt, scope) => ({
  limit,
  remaining: lends(remaining, inFlightIn(scope), 1),
  resetAt,
  mine: 0,
  spanning: inFlightIn(scope),
  spent: 0,
  announced: false,
});

/* Attribution alone: what a window charged them is the server's figure to say and not this one's. */
const charge = (held, carried) => {
  held.spanning += carried;
};

/* Sent against a route no answer has placed: charged to every window, there being no telling which. */
const unattributed = () => [...unknown.values()].reduce((sum, one) => sum + one, 0);

/* At least this much of the window went to something else on this credential. Every doubtful call is
   charged to this process, so a figure above zero is a sibling and a zero is no proof of none. */
const elsewhereIn = (held) => Math.max(0, held.spent - held.mine - held.spanning - unattributed());

export const sawBudget = (key, headers, taken = null) => {
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
  scopes.set(scope, now);
  now.limit = limit;
  now.spent = Math.max(now.spent, limit - remaining);
  /* Downward only, and less what this window has not already charged itself: the reservations among
     the calls in flight came off this figure when they went, and taking them off the server's as
     well charges them twice and drives the window to zero by the whole fan-out (ISS-1947). That
     holds only while this process is the whole of what the figure counts. Once something else on the
     credential is spending it, no figure here says which of this process's own calls the server has
     reached, and the reading falls back to the bound that assumes it has reached none of them. */
  if (now === held) {
    now.remaining = Math.min(now.remaining, elsewhereIn(now) === 0
      ? lends(remaining, unmeteredIn(scope), passedThrough(taken))
      : lends(remaining, inFlightIn(scope), 1));
  }
};

const wentSaid = (held, scope) => {
  const elsewhere = elsewhereIn(held);
  return `Forge paced itself: the ${scope} budget of ${held.limit} is spent for this window`
    + (elsewhere > 0 ? `, at least ${elsewhere} of it by something else on this credential` : "")
    + "; waiting ";
};

export const reserveIn = (key, now, within = Infinity, taken = null) => {
  const held = scopes.get(routes.get(key));
  const went = (charged) => {
    out.set(key, (out.get(key) ?? 0) + 1);
    if (!charged) unmetered.set(key, (unmetered.get(key) ?? 0) + 1);
    if (taken) taken.charged = charged;
    if (!held) unknown.set(key, (unknown.get(key) ?? 0) + 1);
    return null;
  };
  if (!held) return went(false);
  /* The window read is over and the next unknown, so the call goes and its answer opens that one. */
  if (now > held.resetAt) return went(false);
  if (held.remaining > 0) {
    held.remaining -= 1;
    held.mine += 1;
    return went(true);
  }
  const seconds = Math.max(0, (held.resetAt + PAST_RESET_MS - now) / 1000);
  /* The bound handed down is all this may spend: past it the call goes and meets what it would have. */
  if (seconds * 1000 > within) return went(false);
  const said = held.announced ? null : `${wentSaid(held, routes.get(key))}${Math.ceil(seconds)}s for `
    + "the reset the tracker named, rather than sending calls it would refuse.";
  held.announced = true;
  return { seconds, said };
};

/* A retirement carrying no attempt retires a pass-through, that being all a route has out before any
   window of its own exists. */
export const settled = (key, taken = null) => {
  out.set(key, Math.max(0, (out.get(key) ?? 0) - 1));
  if (taken?.charged === true) return;
  unmetered.set(key, Math.max(0, (unmetered.get(key) ?? 0) - 1));
};

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
  unmetered = new Map();
};
