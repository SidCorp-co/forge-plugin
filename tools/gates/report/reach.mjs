/* `spent == reached + blind`, in files, because seconds are the machine's and a faster box shrinks every one of them while the same waste stands. A file no recorded set covers is blind and never reached, that being
   the direction that does not let a narrower answering for nothing read as narrow; `.` is the name a listing of the whole tree is recorded under, every path being inside it; `elsewhere` is the one excess a run can prove, a set recorded under another context having had no chance of matching whatever its content; and `past` is what nothing here explains rather than a measured waste — ISS-1746's plan carries which way the record errs either way, and ISS-1756 why nothing here names a per-file cause. */
import { dirname } from "node:path";

const under = (path, tree) => tree === "." || path === tree || path.startsWith(`${tree}/`);

const touches = (closure, changed) => changed.some((one) =>
  closure.paths.includes(one) || closure.dirs.includes(dirname(one))
  || closure.trees.some((tree) => under(one, tree))
  || closure.whole.some((tree) => under(one, tree)));

export const reachOf = (spend, closures, changed, context) => {
  const at = { reached: 0, blind: 0, elsewhere: 0 };
  for (const one of spend) {
    const closure = closures.get(one);
    if (!closure) at.blind += 1;
    else if (touches(closure, changed)) at.reached += 1;
    else if (closure.context !== undefined && closure.context !== context) at.elsewhere += 1;
  }
  return { ...at, spent: spend.length, past: spend.length - at.reached - at.blind - at.elsewhere };
};
