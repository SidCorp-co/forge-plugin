/* The design kind: the issue's whole design — each criterion classed and proven, the modules it
   touches and the contracts it depends on — PUT to /issues/:id/design, replacing any earlier one and
   bumping its revision. A design hold a run meets at the build rung (../../earned/core-design.mjs) is
   cleared by this write, and only a project whose design gate enforces holds the move on one.
   `@forge/contracts/issue-design` is core's schema; core refuses a payload its module or trace rule
   turns away (DESIGN_REFUSED). docs/cli/record-design.md. */
import { refuse } from "../../../refusal.mjs";
import { DESIGN_CLASSES } from "../../machine.mjs";
import { flags, pullRepeated } from "../../../resolve/flags.mjs";
import { write } from "../../../tracker/rest.mjs";
import { renew } from "../../lease.mjs";

const VERB = "record design";

/** The form a refusal points at, naming every flag the kind's row names so one added there reaches it. */
const designForm = (ref) => `forge record design ${ref} --criterion <n> --class ${DESIGN_CLASSES.join("|")} `
  + `[--pattern <slug>] --proof "<how it is proven>" [--module <m>]... [--contract <c>]...`;

/* Each --criterion opens a block, the flags after it that criterion's own; nothing stands before the
   first, --module and --contract having been pulled from the call already. */
const criterionBlocks = (argv) => {
  const blocks = [];
  for (const token of argv) {
    if (token === "--criterion") blocks.push([token]);
    else if (!blocks.length) {
      refuse(`${VERB}: \`${token}\` stands before the first --criterion. Each criterion opens a block `
        + `with --criterion <n>, and --module and --contract are the call's, named anywhere:\n  ${designForm("<ref>")}`);
    } else blocks.at(-1).push(token);
  }
  return blocks;
};

const criterionOf = (block, usage) => {
  const got = flags(block, VERB, [], { usage });
  if (!/^\d+$/u.test(got.criterion ?? "")) {
    refuse(`${VERB}: --criterion takes the criterion's number, 1 or more, not \`${got.criterion ?? "nothing"}\`.`);
  }
  if (!DESIGN_CLASSES.includes(got.class)) {
    refuse(`${VERB}: criterion ${got.criterion} needs --class, one of ${DESIGN_CLASSES.join(", ")}, not `
      + `\`${got.class ?? "nothing"}\` (observable → a judge at the running product, code_property → the review).`);
  }
  const proof = String(got.proof ?? "").trim();
  if (!proof) refuse(`${VERB}: criterion ${got.criterion} needs --proof: the probe, capture or review line that proves it.`);
  return { criterion: Number(got.criterion), class: got.class, pattern: got.pattern ?? null, proof };
};

const designWritten = async (documentId, reference, data, { next, patch }) => {
  await renew(documentId, reference, next, patch);
  await write("forge_issues.record_design", { documentId, data });
  const criteria = `${data.criteria.length} criteri${data.criteria.length === 1 ? "on" : "a"}`;
  console.log(`${reference}  design recorded: ${criteria}, ${data.modules.length} module(s), `
    + `${data.contracts.length} contract(s). It replaces any design the issue held and clears the `
    + "build gate's hold on it.");
};

/** `forge record design`: the whole design in one PUT, every refusal earned here before it is sent. */
export const designPrepared = async (argv, { reference, issue, next, patch, usage } = {}) => {
  const modules = pullRepeated(argv, "--module", VERB, { usage });
  const contracts = pullRepeated(modules.rest, "--contract", VERB, { usage });
  const blocks = criterionBlocks(contracts.rest);
  if (!blocks.length) {
    refuse(`${VERB} names a criterion per criterion of the issue, each classed and proven, so nothing `
      + `was written:\n  ${designForm(reference)}`);
  }
  const seen = new Set();
  const criteria = blocks.map((block) => {
    const one = criterionOf(block, usage);
    if (seen.has(one.criterion)) {
      refuse(`${VERB} names criterion ${one.criterion} twice; a design classes each criterion once.`);
    }
    seen.add(one.criterion);
    return one;
  });
  const { documentId } = await issue();
  const data = { criteria, modules: modules.values, contracts: contracts.values };
  return { write: () => designWritten(documentId, reference, data, { next, patch }) };
};
