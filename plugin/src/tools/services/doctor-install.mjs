// Read and never repaired: the row names what is missing and the install stays the developer's own call. Rows rather than printed lines, for the same reason doctor-harness.mjs returns them (ISS-885).
import { PUTS_IT_BACK, said, unresolvedIn } from "../../resolve/installed.mjs";

export const installRows = (root) => {
  const found = root === null ? null : unresolvedIn(root);
  if (!found) return [];
  if (found.missing.length === 0) {
    return [{ label: "dependencies", detail: `${found.declared.length} declared, every one resolves  ← package.json` }];
  }
  return [{
    level: "miss",
    label: "dependencies",
    detail: `${found.missing.length} of ${found.declared.length} declared do not resolve under `
      + `node_modules: ${said(found.missing)} — ${PUTS_IT_BACK}`,
  }];
};
