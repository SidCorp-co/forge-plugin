import { resolve } from "node:path";

import { gitFiles } from "../checkout.mjs";
import { forgetContent, ledgerFor } from "./ledger.mjs";
import { gateSteps, TEST_FILE } from "./steps.mjs";

/** How many steps of the whole table the shared record holds green at the content on disk now, out of how many there are, which a release publishes for the head it ships so a branch cut from that head cites a result rather than spending a gate to obtain one. The runner named here has to be the file `tools/gates.mjs` passes as its own, or these digests key on another derivation and match nothing the record holds. */
export const greenHeld = (root) => {
  forgetContent();
  const files = gitFiles(root);
  const { entries } = ledgerFor(gateSteps(files.filter((one) => TEST_FILE.test(one))),
    { root, files, runner: resolve(root, "tools", "gates.mjs") });
  return { green: entries.filter((step) => step.green).length, of: entries.length };
};
