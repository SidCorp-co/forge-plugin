/* Whether a blocking edge still holds its dependant back: the one reading `forge advance`, `forge
   next` and `forge resume` all spend, so none of them can say of an edge other than the rest do. */
import { need } from "../machine.mjs";
import { atLeast, ORDER } from "../earned.mjs";
import { edgeExpired, ordersEdge } from "../../tracker/edges/kinds.mjs";
import { statusKind } from "../../tracker/rest.mjs";

/* The tracker answers this on the edge itself, so the check reads the edge rather than the list it
   arrived in: `relations.blockedBy` carries mentions beside orderings. The kind's row is the
   fallback where no such field came, and an edge carrying neither came from somewhere else. */
export const gatesDispatch = (edge) =>
  edge.gatesDispatch === undefined ? ordersEdge(edge) : edge.gatesDispatch === true;

/** Whether a blocker at this status no longer holds anything: it reached `developed`, which is the
 *  floor this contract reads as landed, or it ended where nothing will land. A status off the ladder
 *  is placed by its own row — a retired name at the rung that took it over, a status only a later
 *  rung reaches at that rung — so a blocker that got further than `developed` never reads as behind
 *  it. A dropped blocker ends the ordering as a closed one does (ISS-347). */
export const blockerEnded = (status) => {
  const kind = statusKind(status);
  if (kind?.landsNothing) return true;
  const rung = ORDER.includes(status) ? status : kind?.replacedBy ?? kind?.past ?? null;
  return atLeast(rung, "developed");
};

/* The tracker gates on a merged mark and this contract's floor is `developed`, so the status is a
   second and independent test — the *blocker's*, which a caller reading the blocker's own row names. */
export const holdsBackFrom = (edge, blocker) =>
  gatesDispatch(edge) && !edgeExpired(edge) && !blockerEnded(blocker);
export const holdsBack = (edge) => holdsBackFrom(edge, edge.otherStatus);

export const ordersSaid = (edge, blocker) => {
  if (edgeExpired(edge)) return "the edge expired";
  if (!gatesDispatch(edge)) return `a ${edge.kind ?? "kindless"} edge orders none`;
  return `the blocker is ${blocker ?? "unread"}`;
};

/* Named in the refusal: an ordering constraint and a mention read alike on a line of their own. */
const edgeKind = (edge) => (edge.kind ? `a ${edge.kind} edge` : "an edge whose kind the tracker did not name");

export const blockersOwed = ({ issue }) =>
  (issue.relations?.blockedBy ?? [])
    .filter(holdsBack)
    .map((one) =>
      need(
        `${one.otherDisplayId} gates this by ${edgeKind(one)} and is ${one.otherStatus}, which is not yet developed`,
        `forge advance ${one.otherDisplayId}`,
      ),
    );
