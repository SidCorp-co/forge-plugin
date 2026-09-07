/* What a version covers, what sits outside one, why SHIPPED is declared — newest first: docs/cli/the-guides.md. */
import { methodScope } from "../resolve/settings.mjs";

export const METHOD = 1;
export const SHIPPED = [METHOD];

export const methodPinned = () => {
  const { value, from, unknown } = methodScope();
  return value === null ? { value: METHOD, from, ...(unknown ? { unknown } : {}) } : { value, from };
};

export const versionDir = (version) => `v${version}`;

/** One line, or none: a pin this copy cannot serve, refused where the pin is read. */
export const pinRefusal = () => {
  const { value, from } = methodPinned();
  if (SHIPPED.includes(value)) return null;
  return `${from} pins method ${value}, and this copy ships ${SHIPPED.join(", ")}: no method text`
    + ` here is this project's. Set \`method\` to one of those, or take the key out —`
    + ` \`forge doctor\` reports what this copy has.`;
};
