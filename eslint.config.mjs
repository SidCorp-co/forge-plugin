import { configure } from "eslint-plugin-code-quality";

export default [
  // Each carries its own config: check-vendor.mjs and `npm run check:package` cover these two.
  { ignores: ["plugin/hooks/vendor/**", "packages/**"] },
  ...configure({
    "no-historical-narration": "error",
    "comment-density": "error",
    "max-consecutive-comment-lines": "error",
    "no-pass-through-wrapper": "error",
    "max-lines": "error",
    "max-lines-per-function": "error",
  }),
];
