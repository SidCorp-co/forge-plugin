/* The fake tracker's find door, asked for issues alone. `state.memory` is `[issue, score]` per arm of
   the door: `semantic` a cosine, `keyword` a text rank. The door answers an issue its meaning arm
   found at its floor (forge's ISSUE_SEMANTIC_FLOOR) and one its keyword arm scored above zero, in the
   order listed, each with the arm that found it and a fused score that orders and measures nothing.
   The duplicate check asks a filing's meaning at one width and its place at the door's most, so that
   width is the place query here: a case says which issues each query finds. */
const DOOR_FLOOR = 0.59;
const DOOR_MOST = 50;

export const foundOf = (state) => ({ limit }) => {
  const arm = limit === DOOR_MOST ? "keyword" : "semantic";
  const kept = ((state.memory ?? {})[arm] ?? [])
    .filter(([, score]) => (arm === "semantic" ? score >= DOOR_FLOOR : score > 0));
  const hits = kept.slice(0, limit).map(([key], at) => {
    const row = [...(state.issues ?? []), ...(state.hidden ?? [])].find((one) => one.issueId === key);
    return { id: `issue:${row?.documentId ?? key}`, type: "issue", ref: row?.documentId ?? key, key,
      title: row?.title ?? `${key} as it was embedded`, status: row?.status ?? null,
      match: { arms: [arm], alias: null }, score: 0.5 / (61 + at) };
  });
  return { groups: hits.length ? [{ type: "issue", label: "Issues", hits }] : [], degraded: false, gap: !hits.length };
};
