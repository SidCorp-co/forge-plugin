/* The project keys a case hands a room standing in for this checkout, and the one place that answers.
   Declared rather than read: this repository keeps its configuration in this machine's record of the
   project and tracks no committed file to read it out of (ISS-2055). So these are the suite's keys
   and not this box's — a case handing them over is asking for a project shaped like this one, and
   the four any case asserts on are `codex.check`, `lease.workingRe`, `stop.agents` and the slug.

   Nothing is imported here, and that is the whole reason this file is not `own-project.mjs`. The
   slug's one source in the product is `PROJECT`, but reaching it pulls `plugin/src/ladder.mjs` in
   through forty-one other modules, and a static import hoists above the line where
   `plugin/test/run/run-fixtures.mjs` moves `XDG_CONFIG_HOME` — which would leave the shape reader
   loaded against the developer's own configuration home. So the slug is typed here and held to
   `PROJECT` by a case instead, in plugin/test/checks/suite/own-project-keys.test.mjs. */

export const OWN = {
  slug: "forge-plugin",
  feedback: { plugin: "bugs", project: "bugs" },
  runs: 2,
  jobs: {
    ba: {
      verbs: ["issue", "new", "comment", "attach", "next", "spec", "guide", "project", "knowledge"],
      skills: ["forge", "vi-natural"],
    },
    developer: {
      verbs: ["issue", "new", "comment", "claim", "resume", "record", "advance", "spec", "attach",
        "next", "guide", "project", "knowledge", "codex", "hooks", "feedback", "stats"],
      skills: ["audit-code-quality", "dispatch", "forge", "gate-review", "harness-eval",
        "issue-flow", "qa", "release-flow", "setup-code-quality", "vi-natural"],
    },
    pm: { verbs: ["issue", "resume", "next", "spec", "guide", "project", "stats"],
      skills: ["forge", "vi-natural"] },
  },
  codex: {
    pathRe: "^(plugin|packages)/(src|hooks|scripts)/.*\\.mjs$|^docs/.*\\.md$",
    angles: ["tech"],
    check: "npm test",
    checkMs: 600000,
    owed: ["gate"],
  },
  rank: {
    readCap: 400,
    agePerDay: 2,
    kind: { bug: 20, enhancement: 12, feature: 8 },
    complexity: { l: 4, xl: 3, unset: 2 },
  },
  lease: {
    workingRe: "^(\\S*(sh|bash) -c )?\\S*node( -\\S+)* \\S*tools/run\\.mjs (ship|land|land-ready)( |$)",
  },
  review: { lines: 4400, paths: ["plugin/src", "plugin/hooks", "plugin/bin", "plugin/test"] },
  stats: { commands: { gate: ["npm run check", "node tools/gates.mjs"] } },
  stop: { agents: ["runner", "reviewer", "triage", "evaluator"] },
};
