/* What a record names as the thing it judged: the source, the landing outside git, and the runtime a
   verdict was exercised at. Apart from machine.mjs, which declares the shapes these fields sit in. */
/* Which of the two a record holds is decided at the write, by `markedIdentity` in record/merged.mjs.
   Each is optional alone and exactly one is owed, which is the shape's own check, so a record read
   back naming both or neither is no whole payload (ISS-2402). */
export const JUDGED_COMMIT = { commit: true, judged: true, optional: true, identity: true };
export const JUDGED_LANDING = { optional: true, landing: true, identity: true };

/* Beside the source and never instead of it: forge-core reads `runtime` before `commit` where a block
   names both (`verdictPairsIn`), and every reading here of what a verdict judged reads the commit,
   which the write fills off the mark. Whole, because an abbreviation of what is serving would let a
   verdict taken somewhere else read as standing, which core's write door refuses by the same words. */
const WHOLE_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/iu;
export const RUNTIME_TAKES = "the whole object id read back from what the deployment reports serving, "
  + "never a branch head and never a command's exit code";
export const runtimeProblem = (value) => {
  if (value === undefined || WHOLE_ID.test(String(value).trim())) return null;
  return /^[0-9a-f]+$/iu.test(String(value).trim())
    ? `--runtime in full, not the abbreviation \`${value}\`: a runtime is named by its whole object id, `
      + "because an abbreviation of what is serving would let a verdict taken somewhere else read as standing"
    : `--runtime as ${RUNTIME_TAKES}, not \`${value}\`, which is no object id`;
};

export const identityProblem = (got) => {
  if (got.commit !== undefined && got.landing !== undefined) {
    return "one of --commit and --landing, not both: a record names what it judged by the one identity its issue lands under";
  }
  if (got.commit === undefined && got.landing === undefined) {
    return "--commit, or --landing where the issue lands outside git";
  }
  return null;
};
