/* Which flow this copy serves, what a flow may override, and why `method` still answers: docs/cli/the-guides.md. */
import { flowScope, methodScope } from "../resolve/settings.mjs";

export const DEFAULT = "default";

/* Declared and never read off the tree; `default` declares neither half, being every flow's base. */
export const FLOWS = { [DEFAULT]: { overrides: [], requires: [] } };

export const FLOW_SLUGS = Object.keys(FLOWS);

export const overridesOf = (flow, flows = FLOWS) => flows[flow]?.overrides ?? [];

export const requiresOf = (flow, flows = FLOWS) => flows[flow]?.requires ?? [];

const RETIRED = 1;

const ROUTE = "Set `flow` to one of those, or take the key out — `forge doctor` reports what this"
  + " copy has.";

const reads = (given) =>
  (typeof given === "number" || typeof given === "string" ? Number(given) : NaN);

/** `flow` present wins declared or not, else `method` reading as the one method ever shipped is `default`, else a present `method` resolves to nothing, else `default`. */
export const flowPinned = () => {
  const flow = flowScope();
  if (flow.value !== undefined) return { value: String(flow.value), from: flow.from };
  const method = methodScope();
  if (method.value === undefined) return { value: DEFAULT, from: method.from };
  const held = String(method.value);
  if (reads(method.value) === RETIRED) return { value: DEFAULT, from: method.from, retired: held };
  return { value: null, from: method.from, method: held };
};

/** One line, or none: the keys name no flow this copy serves, refused where the keys are read. */
export const flowRefusal = () => {
  const { value, from, method } = flowPinned();
  const serves = `this copy serves ${FLOW_SLUGS.join(", ")}`;
  if (value === null) {
    return `${from} sets \`method: ${method}\`, and \`method\` is retired: ${serves}. ${ROUTE}`;
  }
  if (FLOW_SLUGS.includes(value)) return null;
  return `${from} sets \`flow: ${value}\`, and ${serves}: no served text here is this project's.`
    + ` ${ROUTE}`;
};

/** What a served answer ends with: the flow rendered for, the flow a part came from where that is another, and the retired key where it decided. */
export const servedFor = (source = null) => {
  const { value, from, retired } = flowPinned();
  const said = source && source !== value ? `, and this part is ${source}'s` : "";
  return [
    `Flow ${value}, which this project runs${said}; \`forge doctor\` names its source.`,
    ...(retired
      ? [`\`method\` is retired: ${from} sets \`method: ${retired}\`, read as flow ${value}.`]
      : []),
  ];
};
