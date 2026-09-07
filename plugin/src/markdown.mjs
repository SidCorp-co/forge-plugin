/* The markdown primitives the checkers, the spec parser and vi-natural share: the measurements are
   docs/cli/the-primitives.md, the two spans and the two link targets docs/cli/one-primitive-or-two.md. */
const SPAN_INNER = "[^`\\n]";
export const CODE_SPAN_PATTERN = `\`${SPAN_INNER}*\``;
export const CODE_SPAN_NONEMPTY_PATTERN = `\`(${SPAN_INNER}+)\``;
export const LINK_TARGET_OPEN_PATTERN = String.raw`\]\(([^)\s]+)`;
export const LINK_TARGET_PATTERN = String.raw`${LINK_TARGET_OPEN_PATTERN}\)`;
export const LINK_TEXT_PATTERN = String.raw`\[([^\]]*)\]\([^)]*\)`;
const MARGIN = String.raw`[ \t\r]*`;
export const TABLE_ROW_PATTERN = `^${MARGIN}\\|(.*)\\|${MARGIN}$`;
export const TABLE_SEPARATOR_PATTERN = `^${MARGIN}\\|[\\s:|-]+\\|${MARGIN}$`;
export const MARKUP_PATTERN = "[*`_>[\\]()]";
/* A shown line is not a claimed line, and an unclosed fence runs on: docs/cli/the-ladder.md. */
export const EXAMPLE_PATTERN = [
  String.raw`^[ \t]*(?<wall>(?<bar>\x60|~)\k<bar>{2,})[^\n]*\n[\s\S]*?(?:^[ \t]*\k<wall>\k<bar>*[ \t]*$|$(?![\s\S]))`,
  String.raw`^(?: {4}|\t)[^\n]*$`,
].join("|");
const SPANNED = new RegExp(CODE_SPAN_PATTERN, "gu");
const MARKUP = new RegExp(MARKUP_PATTERN, "gu");
const EXAMPLE = new RegExp(EXAMPLE_PATTERN, "gmu");
export const withoutSpans = (text) => String(text ?? "").replace(SPANNED, " ");
export const withoutMarkup = (text) => String(text ?? "").replace(MARKUP, "");
export const withoutExamples = (text) => String(text ?? "").replaceAll(EXAMPLE, "");
export const lineAt = (text, index) => String(text).slice(0, index).split("\n").length;
