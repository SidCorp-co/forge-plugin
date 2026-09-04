import { under } from "./scope.mjs";

/* The gate's steps and the paths each one reads. Nothing is inferred: every step is a script this
   repository owns, spent as `npm run <label>`, so its reads were taken off that script. A step
   whose reads are too narrow does not fail — it passes without having run. */

// Each top-level directory by name, `.` being the top-level files: three steps read the whole tree.
export const EVERYTHING = [".", ".claude-plugin", "docs", "packages", "plugin", "tools"];

/* The suite's whole-repository readers: every tracked file, every `.md`, all of `docs/` against
   CLAUDE.md and the skills, and every path this repository's own prose cites. Left in one `test` step
   they make its honest reads the whole tree; `checks/docs` is claimed whole (ISS-117). */
export const WHOLE_TREE_TESTS = [
  "plugin/test/checks/cited-paths.test.mjs",
  "plugin/test/checks/docs",
  "plugin/test/checks/sources-are-text.test.mjs",
  "plugin/test/tracker/contract.test.mjs",
];

export const TEST_FILE = /^plugin\/test\/.*\.test\.mjs$/u;

export const STEPS = [
  { label: "lint", reads: EVERYTHING },
  { label: "lint:code-quality", reads: EVERYTHING },
  { label: "test:tree", tests: "named", reads: EVERYTHING },
  {
    label: "test",
    tests: "rest",
    /* No root document, proven not assumed: with all 31 non-`requirements` docs plus CLAUDE.md,
       README.md and VI-NATURAL.md overwritten in place and restored, these were 860 pass, 0 fail. */
    reads: [
      ".claude-plugin",
      ".forge.json",
      "docs/requirements",
      "package-lock.json",
      "package.json",
      "packages",
      "plugin",
      "tools",
    ],
  },
  { label: "check:package", reads: ["packages/code-quality"] },
  { label: "check:vi-text", reads: ["plugin/scripts", "plugin/vi-natural", "tools/check-vi-text.mjs"] },
  { label: "check:vi-goldens", reads: ["plugin/scripts", "plugin/vi-natural", "tools"] },
  {
    label: "check:vendor",
    reads: ["packages/code-quality", "plugin/hooks/vendor", "plugin/scripts/check-vendor.mjs"],
  },
  { label: "check:skill-paths", reads: ["plugin"] },
  { label: "check:skill-boundaries", reads: ["plugin/scripts/skill-boundaries.mjs", "plugin/skills"] },
  { label: "check:dup", reads: ["plugin"] },
  {
    label: "sync:skills:check",
    reads: ["packages/code-quality/claude-plugin/skills", "plugin/skills", "tools/sync-skills.mjs"],
  },
];

export const readsWholeTree = (path) => WHOLE_TREE_TESTS.some((claim) => under(path, claim));

export const gateSteps = (found) => {
  const absent = WHOLE_TREE_TESTS.filter((claim) => !found.some((one) => under(one, claim)));
  if (absent.length > 0) {
    throw new Error(`git reports no test file at ${absent.join(", ")}, and tools/gates/steps.mjs `
      + `claims it as a whole-tree read. Correct it there, or the suite runs it in no step.`);
  }
  const files = { named: found.filter(readsWholeTree), rest: found.filter((one) => !readsWholeTree(one)) };
  return STEPS.map((step) => {
    if (step.reads.length === 0) {
      throw new Error(`step ${step.label} declares no reads, so nothing can say when it is stale. `
        + `Give it the paths it reads in tools/gates/steps.mjs.`);
    }
    if (!step.tests) return { ...step, argv: ["npm", "run", step.label] };
    if (files[step.tests].length === 0) {
      throw new Error(`step ${step.label} matches no test file of the ${found.length} git reports; `
        + `its selector is broken and the step would pass without running anything.`);
    }
    return { ...step, argv: [process.execPath, "--test", ...files[step.tests]] };
  });
};
