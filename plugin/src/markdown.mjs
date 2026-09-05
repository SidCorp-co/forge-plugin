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
const SPANNED = new RegExp(CODE_SPAN_PATTERN, "gu");
const MARKUP = new RegExp(MARKUP_PATTERN, "gu");
export const withoutSpans = (text) => String(text ?? "").replace(SPANNED, " ");
export const withoutMarkup = (text) => String(text ?? "").replace(MARKUP, "");
