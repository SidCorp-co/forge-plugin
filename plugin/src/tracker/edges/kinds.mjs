/* What an edge kind MEANS, in one row each, rather than in six readers' comparisons of the name:
   whether it orders a dispatch, whether it is directed, which end a write lands on, which key it
   reads back under. A kind with no row keeps its direction and orders nothing. One row is one edge
   whichever side reads it. Checked by plugin/src/checks/surface/edge-kinds.mjs (ISS-769). */
const expired = (until) => Boolean(until) && Date.parse(until) < Date.now();

const edgeOf = (edge, side) => ({
  edgeId: edge?.id ?? null,
  kind: edge?.kind ?? null,
  ...(edge?.gatesDispatch === undefined ? {} : { gatesDispatch: edge.gatesDispatch }),
  fromIssueId: edge?.fromIssueId ?? null,
  toIssueId: edge?.toIssueId ?? null,
  otherIssueId: edge?.[`${side}IssueId`] ?? null,
  otherDisplayId: edge?.[`${side}DisplayId`] ?? null,
  otherStatus: edge?.[`${side}Status`] ?? null,
  otherMergedAt: edge?.[`${side}MergedAt`] ?? null,
  validUntil: edge?.validUntil ?? null,
  expired: expired(edge?.validUntil),
});

export const RELATES = "relates";

const EDGE_ROWS = [
  { kind: "blocks", orders: true, directed: true, writtenOn: "other", readsBack: "blockedBy" },
  { kind: RELATES, orders: false, directed: false, writtenOn: "subject", readsBack: RELATES },
];

export const EDGE_KINDS = EDGE_ROWS.map((row) => row.kind);

export const edgeRow = (kind) => EDGE_ROWS.find((row) => row.kind === kind) ?? null;

export const directedEdge = (edge) => edgeRow(edge?.kind)?.directed ?? true;
export const ordersEdge = (edge) => edgeRow(edge?.kind)?.orders ?? false;

export const otherOf = (edge) => edge?.otherDisplayId ?? edge?.otherIssueId ?? null;

export const relationsOf = (deps) => {
  const out = (deps?.outgoing ?? []).map((edge) => edgeOf(edge, "to"));
  const held = (deps?.incoming ?? []).map((edge) => edgeOf(edge, "from"));
  return {
    blocks: out.filter(directedEdge),
    blockedBy: held.filter(directedEdge),
    relates: [...out, ...held].filter((edge) => !directedEdge(edge)),
  };
};
