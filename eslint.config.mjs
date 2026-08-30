import { configure } from "eslint-plugin-code-quality";

export default [
  // A vendored copy is upstream's to lint; check-vendor.mjs reports drift instead.
  { ignores: ["plugin/hooks/vendor/**"] },
  ...configure({
    "no-historical-narration": "error",
    "comment-density": "error",
    "max-consecutive-comment-lines": "error",
    "no-pass-through-wrapper": "error",
    "max-lines": "error",
    "max-lines-per-function": "error",
  }),
];
