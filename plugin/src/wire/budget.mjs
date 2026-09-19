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

const numbered = (headers, name) => {
  const said = headers?.get?.(name);
  const held = String(said ?? "").trim() === "" ? NaN : Number(said);
  return Number.isFinite(held) ? held : null;
};

/* A dropped connection never answers, so this only drifts upward, claiming ever less for anybody else. */
const outstandingIn = (held) => Math.max(0, held.sent - held.answers);

/* A call reserved before a reset may be charged after it, so what was outstanding at the adoption
   belongs to either window and is subtracted from both rather than credited to a sibling. */
const opened = (limit, remaining, resetAt, held, carried) => {
  const from = { sent: (held?.sent ?? 0) + carried, answers: held?.answers ?? 0 };
  const spanning = outstandingIn(from);
  return {
    limit,
    /* Those still out are not in the reading, so a window lends only what is left once they are off it. */
    remaining: Math.max(0, remaining - Math.max(0, spanning - 1)),
    resetAt,
    sent: from.sent,
    answers: from.answers,
    mine: 0,
    spanning,
    spent: 0,
    announced: false,
  };
};

const charge = (held, carried) => {
  held.sent += carried;
  held.spanning += carried;
};

export const sawBudget = (key, headers) => {
  const scope = headers?.get?.(SCOPE);
  const [limit, remaining, reset] = [LIMIT, REMAINING, RESET].map((name) => numbered(headers, name));
  if (!scope || limit === null || remaining === null || reset === null) return;
  const carried = key && !routes.has(key) ? (unknown.get(key) ?? 0) : 0;
  if (key) {
    routes.set(key, scope);
    unknown.delete(key);
  }
  const resetAt = reset * 1000;
  const held = scopes.get(scope);
  /* The reading is a window already past and says nothing of this one; the calls behind it are this
     process's either way, and dropping them with the reading is how they become somebody else's. */
  if (held && resetAt < held.resetAt) return charge(held, carried);
  const now = !held || resetAt > held.resetAt ? opened(limit, remaining, resetAt, held, carried) : held;
  if (now === held) charge(now, carried);
  scopes.set(scope, now);
  now.answers += 1;
  now.limit = limit;
  /* Downward only: a header written before the calls in flight were counted overstates what is left. */
  if (now === held) now.remaining = Math.min(now.remaining, remaining);
  now.spent = Math.max(now.spent, limit - remaining);
};

/* Sent by this process against a route no answer has named a bucket for yet: they belong to one of
   these windows and there is no telling which, so every window is charged with all of them. */
const unattributed = () => [...unknown.values()].reduce((sum, one) => sum + one, 0);

const wentSaid = (held, scope) => {
  const elsewhere = Math.max(0, held.spent - held.mine - held.spanning - unattributed());
  return `Forge paced itself: the ${scope} budget of ${held.limit} is spent for this window`
    + (elsewhere > 0 ? `, at least ${elsewhere} of it by something else on this credential` : "")
    + "; waiting ";
};

export const reserveIn = (key, now, within = Infinity) => {
  const held = scopes.get(routes.get(key));
  if (!held) {
    unknown.set(key, (unknown.get(key) ?? 0) + 1);
    return null;
  }
  const went = () => {
    held.sent += 1;
    return null;
  };
  /* The window read is over and the next unknown, so the call goes and its answer opens that one. */
  if (now > held.resetAt) return went();
  if (held.remaining > 0) {
    held.remaining -= 1;
    held.mine += 1;
    return went();
  }
  const seconds = Math.max(0, (held.resetAt + PAST_RESET_MS - now) / 1000);
  /* The bound handed down is the whole of what this may spend: past it the call goes, and meets
     whatever it would have met with none of this. */
  if (seconds * 1000 > within) return went();
  const said = held.announced ? null : `${wentSaid(held, routes.get(key))}${Math.ceil(seconds)}s for `
    + "the reset the tracker named, rather than sending calls it would refuse.";
  held.announced = true;
  return { seconds, said };
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
};
