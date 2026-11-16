import { block, touched } from "../../../hooks/_hook.mjs";

export const run = (ev) => {
  if (touched(ev).length) block("Fix what this fixture blocks on");
};
