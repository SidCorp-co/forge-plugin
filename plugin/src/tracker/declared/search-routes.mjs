/* The two searches this CLI asks core, both filters of its one find door (forge ISS-1256), as declared
   rows. Their own file to keep `routes.mjs` within one reading, and handed the helper they build with
   rather than copying it, so there is still one `one`. docs/cli/one-transport.md. */

/* A hit as its readers resolve it: the uuid and key of its issue, and the arms that found it. The
   fused score it carries is left behind, because it orders the hits and measures nothing. */
const issueHit = (hit) => ({ documentId: hit?.ref ?? null, issueId: hit?.key ?? null, title: hit?.title ?? null,
  status: hit?.status ?? null, arms: hit?.match?.arms ?? [] });

export const searchRoutes = ({ one }) => ({
  /* The find door asked for issues alone, its hits in its own order. `degraded` is the door saying
     its meaning arms did not run, which a reader of the hits cannot tell from an answer by meaning. */
  "forge_find.issues": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/find`, "POST", { q: args.q, type: ["issue"], limit: args.limit }),
    answers: ({ page }) => ({
      hits: (page?.groups ?? []).filter((group) => group?.type === "issue").flatMap((group) => group.hits ?? []).map(issueHit),
      degraded: page?.degraded === true,
    }),
    sends: ["q", "limit"],
  },
  /* The find door's memory filter: it ranks one way, so it takes no `strategy`, and it reads curated
     memory alone, so an issue, comment or job copy is no source of it. Both are refused here, on a
     core that would still take them as on one that refuses them. */
  "forge_memory.search": {
    project: true,
    requests: (args, project) => one(`/memory/search`, "POST", { ...args, projectId: project }),
    sends: ["query", "topK", "sourceFilter"],
    honours: { sourceFilter: ["note", "knowledge", "policy", "decision"] },
  },
});
