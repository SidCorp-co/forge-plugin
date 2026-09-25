/* The edge writes of `forge issue`: `--blocks` and `--relates` add one, `--unlink` removes one.
   What each kind means is kinds.mjs; the verb that judges the flags is commands.mjs. */
import { fail } from "../../resolve/settings.mjs";
import { scoped, write } from "../rest.mjs";
import { documentIdOf } from "../issues.mjs";
import { mustBeShown } from "../comments.mjs";
import { finderSaid, notAnothers, renew } from "../../flow/lease.mjs";
import { EDGE_KINDS, edgeRow, otherOf } from "./kinds.mjs";

const kindOf = (edge) => edge?.kind ?? "an unnamed kind";

/* The edge id is the tracker's and no caller holds one, so both a write and a removal read the
   pair's edges first — all of them, the first of an object's values being an insertion order
   rather than an answer. The subject's relations carry both directions, so one read is the pair. */
const pairEdges = async (subjectId, otherId) => {
  const held = await scoped("forge_issues", { action: "get", documentId: subjectId, fields: ["relations"] });
  return Object.values(held?.relations ?? {}).flat().filter((edge) => edge.otherIssueId === otherId);
};

/* A link lands as `(from = dependsOnId, to = the route's issue)`, so the edge a write would repeat
   is that one, and for a kind whose row orders no direction the same pair the other way round too:
   a second edge there is the same relation twice, and --unlink can only ever name one of them. */
const standingEdge = (held, kind, written) => held.find((edge) => edge.kind === kind
  && ((edge.fromIssueId === written.dependsOnId && edge.toIssueId === written.id)
    || (!edgeRow(kind).directed && edge.fromIssueId === written.id && edge.toIssueId === written.dependsOnId)));

const stands = (edge, subject, other, subjectId) =>
  `${subject} ${edge.kind} ${other} already: edge ${edge.edgeId}, from `
  + `${edge.fromIssueId === subjectId ? subject : other}, stands, so nothing was written.`;

/* The route out for each kind among `pool`: `--kind` where that kind selects one edge of the pair
   and is one this CLI serves, and otherwise `--edge` once for every edge of it, so each line
   printed is a call that removes exactly one edge rather than one refused a second time. */
const routesOut = (pool, held, subject, other) => [...new Set(pool.map(kindOf))].flatMap((kind) => {
  const same = held.filter((edge) => kindOf(edge) === kind);
  return same.length === 1 && EDGE_KINDS.includes(kind) ? [`--kind ${kind}`]
    : same.map((edge) => `--edge ${edge.edgeId}`);
}).map((tail) => `  forge issue ${subject} --unlink ${other} ${tail}`).join("\n");

const namedEdge = (held, subject, other, id) => {
  const found = held.find((edge) => edge.edgeId === id);
  if (found) return found;
  const holds = held.map((edge) => `${edge.edgeId} (${kindOf(edge)})`).join(", ");
  const lines = held.map((edge) => `  forge issue ${subject} --unlink ${other} --edge ${edge.edgeId}`);
  fail(`issue: ${subject} and ${other} hold no edge ${id}, and the ${held.length} they do hold `
    + `${held.length === 1 ? "is" : "are"} ${holds}. Nothing was sent. Name one of them:\n${lines.join("\n")}`);
  return null;
};

/* One edge, or a refusal saying which it could not do: name an edge the pair has, or name one of
   them. A pair carrying two of one kind is answered by `--edge`, which `--kind` cannot tell apart. */
const oneEdgeOf = (held, subject, other, asked) => {
  if (!held.length) {
    fail(`issue: ${subject} and ${other} have no edge between them, so there is none to remove and `
      + `nothing was sent. \`forge issue ${subject} --fields relations\` prints what it does have.`);
  }
  if (asked.edge !== undefined) return namedEdge(held, subject, other, asked.edge);
  const wanted = asked.kind === undefined ? held : held.filter((edge) => edge.kind === asked.kind);
  if (wanted.length === 1) return wanted[0];
  const has = [...new Set(held.map(kindOf))].join(", ");
  const said = wanted.length
    ? `${subject} and ${other} have ${wanted.length} edges between them, ${has}, and --unlink removes one`
    : `${subject} and ${other} have no ${asked.kind} edge between them, and what they do have is ${has}`;
  fail(`issue: ${said}. Nothing was sent. Name which:\n`
    + `${routesOut(wanted.length ? wanted : held, held, subject, other)}`);
  return null;
};

export const wroteEdge = async (subject, asked) => {
  const kind = EDGE_KINDS.find((one) => asked[one] !== undefined);
  const other = kind ? asked[kind] : asked.unlink;
  const [subjectId, otherId] = await Promise.all([documentIdOf(subject), documentIdOf(other)]);
  if (subjectId === otherId) {
    fail(`issue: ${subject} and ${other} are one issue, and an issue neither blocks nor relates to `
      + "itself. Nothing was sent.");
  }
  /* The end the kind's row names is the end the route is taken against, and a removal is taken
     against the subject, whose row holds the edge id. Neither end is claimed for an edge, and the
     live check asks after the row this call writes and not the other (ISS-1423). */
  const row = edgeRow(kind);
  const written = row?.writtenOn === "other"
    ? { id: otherId, ref: other, dependsOnId: subjectId }
    : { id: subjectId, ref: subject, dependsOnId: otherId };
  const held = await pairEdges(subjectId, otherId);
  /* Settled before the lease and the thread, both of which exist for a write this call no longer makes. */
  const already = row ? standingEdge(held, kind, written) : undefined;
  if (already) return stands(already, subject, other, subjectId);
  const found = row ? null : oneEdgeOf(held, subject, other, asked);
  /* The end written on is the end the read-first gate resolves, and it stands down for this verb because the thread goes out here, ahead of the write, whether or not a gate is watching (ISS-1724). */
  await mustBeShown([{ ref: written.ref, documentId: written.id }]);
  const renewed = await renew(written.id, written.ref, undefined, null, { finder: true });
  await notAnothers(written.id, written.ref);
  console.log(finderSaid(written.ref, renewed));
  if (found) {
    await write("forge_issues", { action: "unlink_edge", documentId: subjectId, edgeId: found.edgeId });
    return `${subject} —/— ${other}: removed the ${kindOf(found)} edge ${found.edgeId} to `
      + `${otherOf(found) ?? "the other end"}.`;
  }
  await write("forge_issues", { action: "link", documentId: written.id,
    data: { dependsOnId: written.dependsOnId, kind } });
  return `${subject} ${kind} ${other}: written on the ${written.ref} dependency route, and reads back `
    + `under ${row.readsBack} there.`;
};
