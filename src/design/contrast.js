import { readFileSync } from "node:fs";
import path from "node:path";
import {
  contrastRatio,
  DEFAULT_MARKUP_EXTENSIONS,
  isTranslucentHex,
  parseHexColor,
  readTokenSources,
  resolveTokenAliases,
  sourceFiles,
} from "./tokens.js";

/**
 * WCAG 2.1 minimum ratios: 1.4.3 for text, and 1.4.11 for component boundaries
 * and focus indicators.
 */
export const DEFAULT_CONTRAST_THRESHOLDS = { text: 4.5, largeText: 3, nonText: 3 };

/**
 * A pair is checked against the token file, so the numbers track the theme
 * rather than a transcription of it. This is not an ESLint rule: a token file
 * plus every screen that pairs two tokens is project-wide knowledge, and a
 * per-file rule would report the same pair once per file that mentions it.
 */
function utilityPattern(kind) {
  return new RegExp(`(?:^|[\\s:])${kind}-([a-z0-9-]+)(?![\\w./[-])`, "g");
}

function resolveNeed(need, thresholds) {
  if (need === undefined) return thresholds.text;
  if (typeof need === "number") return need;
  const resolved = thresholds[need];
  if (resolved === undefined) {
    throw new TypeError(`Unknown contrast threshold "${need}": ${Object.keys(thresholds).join(", ")}`);
  }
  return resolved;
}

// A pair a className states outright: one background utility and one foreground
// utility on the same element. Utilities carrying an opacity or an arbitrary
// value are skipped — what they composite against is not in the token table.
function scanPairs({ roots, extensions, ignoredDirectories, tokenPrefix, tokens }) {
  const pairs = new Map();
  for (const file of sourceFiles({ roots, extensions, ignoredDirectories })) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const literal of text.matchAll(/(["'`])((?:[^\\\n`]|\\.)*?)\1/g)) {
      const value = literal[2];
      const backgrounds = [...value.matchAll(utilityPattern("bg"))];
      const foregrounds = [...value.matchAll(utilityPattern("text"))];
      for (const background of backgrounds) {
        for (const foreground of foregrounds) {
          const bg = `${tokenPrefix}${background[1]}`;
          const fg = `${tokenPrefix}${foreground[1]}`;
          if (fg === bg || !tokens.has(fg) || !tokens.has(bg)) continue;
          const key = `${fg}|${bg}`;
          if (pairs.has(key)) continue;
          const source = path.relative(process.cwd(), file) || file;
          pairs.set(key, { fg, bg, why: `paired in ${source}`, source });
        }
      }
    }
  }
  return [...pairs.values()];
}

/**
 * Contrast failures across a theme. `tokenFile` is required and has no default:
 * every project names its token file differently, and guessing one would report
 * a clean run over tokens that were never read.
 */
export function findContrastFailures({
  tokenFile,
  block,
  tokenPattern,
  sources,
  tokenPrefix = "--color-",
  roots = ["."],
  extensions = DEFAULT_MARKUP_EXTENSIONS,
  ignoredDirectories,
  declaredPairs = [],
  allow = [],
  thresholds = DEFAULT_CONTRAST_THRESHOLDS,
  scanMarkup = true,
} = {}) {
  const from = sources ?? (tokenFile ? [{ file: tokenFile, block, tokenPattern }] : []);
  if (from.length === 0) {
    throw new TypeError(
      "findContrastFailures needs { tokenFile }: the CSS file the design tokens are declared in.",
    );
  }
  const declaredIn = from.map((source) => source.file).join(", ");

  for (const pair of [...declaredPairs, ...allow]) {
    if (!pair.fg || !pair.bg) throw new TypeError("A contrast pair needs { fg, bg } token names.");
  }
  // A standing failure is a design decision someone owns, so it has to say so.
  for (const entry of allow) {
    if (!entry.why) throw new TypeError(`Allowing ${entry.fg} on ${entry.bg} needs a reason.`);
  }

  const limits = { ...DEFAULT_CONTRAST_THRESHOLDS, ...thresholds };
  const tokens = resolveTokenAliases(readTokenSources(from));
  const waived = new Map(allow.map((entry) => [`${entry.fg}|${entry.bg}`, entry.why]));
  const pairs = [
    ...declaredPairs.map((pair) => ({ ...pair, source: "declared" })),
    ...(scanMarkup ? scanPairs({ roots, extensions, ignoredDirectories, tokenPrefix, tokens }) : []),
  ];

  const failures = [];
  const waivers = [];

  for (const pair of pairs) {
    const need = resolveNeed(pair.need, limits);
    const foreground = tokens.get(pair.fg) ?? null;
    const background = tokens.get(pair.bg) ?? null;
    const entry = { ...pair, need, foreground, background, ratio: null, reason: null };

    if (foreground === null || background === null) {
      entry.reason = `unknown token — not declared in ${declaredIn}`;
    } else if (isTranslucentHex(foreground) || isTranslucentHex(background)) {
      entry.reason = "translucent token — contrast needs the colour it composites over";
    } else if (parseHexColor(foreground) === null || parseHexColor(background) === null) {
      entry.reason = "unsupported token value — contrast needs a hex colour";
    } else {
      entry.ratio = contrastRatio(foreground, background);
      if (entry.ratio >= need) continue;
      entry.reason = `${entry.ratio.toFixed(2)}:1, needs ${need}:1`;
    }

    const waiver = waived.get(`${pair.fg}|${pair.bg}`);
    // The pair's own `why` says where it renders; the waiver says why the
    // failure is allowed to stand, and a scanned pair has no room for the second.
    if (waiver === undefined) failures.push(entry);
    else waivers.push({ ...entry, waivedBecause: waiver });
  }

  return { tokens, pairs, failures, waivers };
}
