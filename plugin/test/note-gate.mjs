import { context, touched } from "../hooks/_hook.mjs";

export const run = (ev) => {
  if (touched(ev).length) context("You changed a document this turn");
};
