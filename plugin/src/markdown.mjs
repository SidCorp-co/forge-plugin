/* The markdown primitives the checkers and the spec parser share: docs/cli/the-primitives.md. */
export const CODE_SPAN_PATTERN = "`[^`\\n]*`";
export const LINK_TARGET_PATTERN = String.raw`\]\(([^)\s]+)\)`;
export const LINK_TEXT_PATTERN = String.raw`\[([^\]]*)\]\([^)]*\)`;
const MARGIN = String.raw`[ \t\r]*`;
export const TABLE_ROW_PATTERN = `^${MARGIN}\\|(.*)\\|${MARGIN}$`;
export const TABLE_SEPARATOR_PATTERN = `^${MARGIN}\\|[\\s:|-]+\\|${MARGIN}$`;
export const MARKUP_PATTERN = "[*`_>[\\]()]";
const SPANNED = new RegExp(CODE_SPAN_PATTERN, "gu");
const MARKUP = new RegExp(MARKUP_PATTERN, "gu");
export const withoutSpans = (text) => String(text ?? "").replace(SPANNED, " ");
export const withoutMarkup = (text) => String(text ?? "").replace(MARKUP, "");
