/* The budget the tracker states on every answer, held per scope the server names, so a fanning-out
   call waits for a window it has read rather than discovering it a hundred times over by being
   refused (ISS-1849). An answer from a window already past may not unspend the window standing. */

const SCOPE = "x-ratelimit-scope";
const LIMIT = "x-ratelimit-limit";
const REMAINING = "x-ratelimit-remaining";
const RESET = "x-ratelimit-reset";
const PAST_RESET_MS = 1000;

let scopes = new Map();
let routes = new Map();

const numbered = (headers, name) => {
  const held = Number(headers?.get?.(name));
  return Number.isFinite(held) ? held : null;
};

/* A dropped connection never answers, so this only drifts upward, claiming ever less for anybody else. */
const outstandingIn = (held) => Math.max(0, held.sent - held.answers);

/* A call reserved before a reset may be charged after it, so what was outstanding at the adoption
   belongs to either window and is subtracted from both rather than credited to a sibling. The first
   answer of all is its own such call: it went out before this knew the route had a scope. */
const opened = (limit, remaining, resetAt, held) => {
  const from = held ?? { sent: 1, answers: 0 };
  return {
    limit,
    remaining,
    resetAt,
    sent: from.sent,
    answers: from.answers,
    mine: 0,
    spanning: outstandingIn(from),
    elsewhere: 0,
    announced: false,
  };
};

export const sawBudget = (key, headers) => {
  const scope = headers?.get?.(SCOPE);
  const [limit, remaining, reset] = [LIMIT, REMAINING, RESET].map((name) => numbered(headers, name));
  if (!scope || limit === null || remaining === null || reset === null) return;
  if (key) routes.set(key, scope);
  const resetAt = reset * 1000;
  const held = scopes.get(scope);
  if (held && resetAt < held.resetAt) return;
  const now = !held || resetAt > held.resetAt ? opened(limit, remaining, resetAt, held) : held;
  scopes.set(scope, now);
  now.answers += 1;
  now.limit = limit;
  /* Downward only inside one window: a header is written before the calls still in flight are
     counted, so a later one saying more is left is a stale view of it. */
  now.remaining = now === held ? Math.min(now.remaining, remaining) : remaining;
  now.elsewhere = Math.max(0, limit - remaining - now.mine - now.spanning);
};

const wentSaid = (held, scope) =>
  `Forge paced itself: the ${scope} budget of ${held.limit} is spent for this window`
  + (held.elsewhere > 0 ? `, at least ${held.elsewhere} of it by something else on this credential` : "")
  + "; waiting ";

export const reserveIn = (key, now = Date.now()) => {
  const held = scopes.get(routes.get(key));
  if (!held) return null;
  const went = () => {
    held.sent += 1;
    return null;
  };
  /* Past the stated reset the window read is over and nothing of the next is known, so the call goes
     and its answer opens that one — admitting the calls in flight, as this moment does today. */
  if (now > held.resetAt) return went();
  if (held.remaining > 0) {
    held.remaining -= 1;
    held.mine += 1;
    return went();
  }
  const seconds = Math.max(0, (held.resetAt + PAST_RESET_MS - now) / 1000);
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
};
