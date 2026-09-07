/* What a version covers, what sits outside one, why SHIPPED is declared — newest first: docs/cli/the-guides.md. */
import { methodScope } from "../resolve/settings.mjs";

export const METHOD = 1;
export const SHIPPED = [METHOD];

export const methodPinned = () => {
  const { value, from, unknown } = methodScope();
  return value === null ? { value: METHOD, from, ...(unknown ? { unknown } : {}) } : { value, from };
};

export const versionDir = (version) => `v${version}`;
