/* The fake tracker's labels, and the two issue reads that turn on them: `state.labels` is the
   project's label list, a module being one whose kind says so, and an issue's own `labels` are
   `{ id, isPrimary }`, which is how the tracker's issue read carries them. */
export const labelsOf = (state) => {
  const labelled = (id) => (state.labels ?? []).find((one) => one.id === id);
  const attributed = (args) => {
    const rows = (state.issues ?? [])
      .filter((one) => !args.statuses.length || args.statuses.includes(one.status))
      .filter((one) => !args.statusNot.includes(one.status))
      .filter((one) => !args.module || (one.labels ?? []).some((held) => held.id === args.module))
      .map((one) => ({ ...one, modules: (one.labels ?? []).filter((held) => labelled(held.id)?.kind === "module")
        .map((held) => ({ labelId: held.id, name: labelled(held.id)?.name, isPrimary: Boolean(held.isPrimary) }))
        .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary)) }));
    return { issues: rows, returned: rows.length, hasMore: false };
  };
  /* A write of `labels` replaces the set, as the tracker's does, so a read after it sees the new one. */
  const relabel = (args) => {
    const issue = (state.issues ?? []).find((one) => one.documentId === args.documentId);
    if (issue) {
      issue.labels = args.data.labels.map((one) => (typeof one === "string"
        ? { id: one, isPrimary: false } : { id: one.labelId, isPrimary: Boolean(one.isPrimary) }));
    }
    return { documentId: args.documentId, ...(issue ?? {}) };
  };
  const labels = (args) => {
    const held = (state.labels ??= []);
    if (args.action === "list") return held;
    if (args.action === "create") {
      const row = { id: `label-${held.length + 1}`, parentId: null, description: null, ...args.data };
      held.push(row);
      return row;
    }
    const at = held.findIndex((one) => one.id === args.labelId);
    if (at < 0) return { refused: "label not found", code: "NOT_FOUND" };
    if (args.action === "update") return Object.assign(held[at], args.data);
    if ((state.issues ?? []).some((one) => (one.labels ?? []).some((label) => label.id === args.labelId))) {
      return { refused: "label is attached to issues", code: "LABEL_IN_USE" };
    }
    held.splice(at, 1);
    return null;
  };
  return { attributed, relabel, labels };
};
