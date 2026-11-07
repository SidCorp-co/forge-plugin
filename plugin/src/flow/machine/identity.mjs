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
export const RUNTIME_TAKES = "the whole id the deployment reports, never a branch head";
const runtimeProblem = (value) => {
  if (value === undefined || WHOLE_ID.test(String(value).trim())) return null;
  return /^[0-9a-f]+$/iu.test(String(value).trim())
    ? `--runtime in full, not the abbreviation \`${value}\`: a runtime is named by its whole object id, `
      + "because an abbreviation of what is serving would let a verdict taken somewhere else read as standing"
    : `--runtime as ${RUNTIME_TAKES}, not \`${value}\`, which is no object id`;
};

/* The two identities ISS-19 adds to a verdict beside the commit it reads and the runtime it ran at: a
   storefront draft, named by `<workflow>@draft:<version>` on --runtime with the --environment it was
   judged on, and a contract version. Both grammars mirror forge-core's own (its verdict-identity
   module's STOREFRONT_DRAFT_RUNTIME and CONTRACT_SHAPE): a form this refuses that core takes strands a
   judge, and one it takes that core refuses is a round spent for nothing, so the two stay the same
   bytes. */
const DRAFT_RUNTIME = /^(\S+)@draft:(\S+)$/u;
const CONTRACT_SHAPE = /^([a-z][a-z0-9-]{0,62})\/([a-z][a-z0-9-]{0,62})@(\S{1,40})$/u;

export const draftRuntimeOf = (value) => {
  const match = DRAFT_RUNTIME.exec(String(value ?? "").trim());
  return match ? { workflowId: match[1], draftVersion: match[2] } : null;
};
const contractOf = (value) => {
  const match = CONTRACT_SHAPE.exec(String(value ?? "").trim());
  return match ? { project: match[1], contract: match[2], version: match[3] } : null;
};

/* Taught by the refusal, not by `record verdict -h`, which is at its byte cap (ISS-7): the writer that
   names a bad --contract or a draft runtime with no --environment reads the grammar in the message. */
const CONTRACT_TAKES = "a contract version this issue's project recorded, `<project>/<contract>@<version>`";
const ENVIRONMENT_TAKES = "a non-production environment the storefront draft was judged on, e.g. preview";

const contractProblem = (value) =>
  value === undefined || contractOf(value) !== null
    ? null
    : `takes ${CONTRACT_TAKES}, not \`${value}\``;

export const identityProblem = (got) => {
  if (got.commit !== undefined && got.landing !== undefined) {
    return "one of --commit and --landing, not both: a record names what it judged by the one identity its issue lands under";
  }
  if (got.commit === undefined && got.landing === undefined) {
    return "--commit, or --landing where the issue lands outside git";
  }
  return null;
};

/* A verdict names what it judged by one identity, and ISS-19 widens the one the writer could reach
   (only --commit/--landing, with --runtime as a whole id beside it) to a storefront draft or a
   contract version, which name no git commit. Exactly one family stands: --commit/--landing (the
   existing rule, --runtime beside it still a whole id), the draft runtime with its environment, or a
   contract. Named together they would claim two things judged at once, so that is refused by name. */
export const verdictIdentityProblem = (got) => {
  const draft = draftRuntimeOf(got.runtime) !== null;
  const hasContract = got.contract !== undefined;
  const hasRelease = got.release !== undefined;
  const hasCommitOrLanding = got.commit !== undefined || got.landing !== undefined;
  if (hasRelease && got.runtime !== undefined) {
    return "one identity: --release names the shipped version judged, so it takes no --runtime beside it";
  }
  if (got.environment !== undefined && !draft) {
    return "--environment names the environment a storefront draft `--runtime <workflow>@draft:<version>` "
      + "was judged on, so it is given only beside that runtime";
  }
  if (draft && got.environment === undefined) {
    return `--environment <${ENVIRONMENT_TAKES}>: a storefront draft \`--runtime <workflow>@draft:<version>\` `
      + "names the environment it was judged on, which core places the draft by";
  }
  const contractBad = contractProblem(got.contract);
  if (contractBad) return `--contract ${contractBad}`;
  const families = [hasCommitOrLanding, draft, hasContract, hasRelease].filter(Boolean).length;
  if (families > 1) {
    return "one identity: a verdict names what it judged by one of --commit/--landing, a storefront draft "
      + "(--runtime <workflow>@draft:<version> with --environment), --contract <project>/<contract>@<version>, "
      + "or --release <version> — not several";
  }
  if (draft || hasContract || hasRelease) return null;
  return identityProblem(got) ?? runtimeProblem(got.runtime);
};
