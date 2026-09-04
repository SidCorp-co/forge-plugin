/* The CLAUDE.md half of `forge doctor`: a guide this plugin stands behind is the authority and a
   project file restating one has forked it. Which, and why: docs/cli/the-guides.md, docs/cli/doctor.md. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { join } from "node:path";

import {
  DEFAULT_MIN_SENTENCE_LENGTH,
  DEFAULT_OVERLAP_FLOOR,
  DEFAULT_OVERLAP_THRESHOLD,
  findOverlapsAgainst,
  splitSentences,
} from "../../hooks/vendor/text-overlap.js";
import { load } from "./duplication.mjs";
import {
  CODE_SPAN_PATTERN,
  LINK_TARGET_PATTERN,
  TABLE_ROW_PATTERN,
  withoutSpans,
} from "../markdown.mjs";

/* Not the shared 0.34/5: that was calibrated on comments inside one file, where two copies share
   twice the vocabulary two documents do. Measured over 28 CLAUDE.md files — docs/cli/doctor.md. */
export const GUIDE_OVERLAP_THRESHOLD = 0.25;
export const GUIDE_OVERLAP_FLOOR = 3;

const FENCE = /^\s*(?:```|~~~)/u;
const HEADING = /^#{1,6}\s/u;
const TABLE_ROW = new RegExp(TABLE_ROW_PATTERN, "u");
const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+/u;
const MARKUP = /[*`_>[\]()]/gu;

/* The waiver grammar the ESLint rules use: a marker, an em dash, a reason that is not optional. */
const OVERRIDE = /overrides:\s*([a-z0-9][a-z0-9-]*)\s*(?:—|--)\s*(\S.*?)\s*$/u;

/* A fenced block is a code example, and an example of the marker is not a declaration of it. */
function* unfenced(text) {
  let fenced = false;
  for (const [index, line] of text.split("\n").entries()) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      yield [index, null];
    } else if (!fenced) yield [index, line];
  }
}

/* Sentences with the span of source they came from, blocks broken at a blank line, heading, table
   row or new bullet — so a finding points at one rule and not at the paragraph above it. */
export function statements(text, minLength = DEFAULT_MIN_SENTENCE_LENGTH) {
  const units = [];
  let block = [];
  let start = 0;
  const flush = (end) => {
    const prose = block.join(" ").replace(MARKUP, "");
    for (const sentence of splitSentences(prose, minLength)) units.push([{ start, end }, sentence]);
    block = [];
  };
  for (const [index, line] of unfenced(text)) {
    if (line === null) {
      flush(index);
      continue;
    }
    if (!line.trim() || HEADING.test(line) || TABLE_ROW.test(line) || BULLET.test(line)) {
      flush(index);
    }
    if (!line.trim() || HEADING.test(line) || TABLE_ROW.test(line)) continue;
    if (!block.length) start = index + 1;
    block.push(line.replace(BULLET, "").trim());
  }
  flush(text.split("\n").length);
  return units;
}

/** Every `overrides:` marker, with the line it sits on so a block can claim the ones inside it. */
export function overrideMarkers(text) {
  const found = [];
  for (const [index, line] of unfenced(text)) {
    const hit = line === null ? null : OVERRIDE.exec(line);
    if (hit) found.push({ line: index + 1, slug: hit[1], reason: hit[2] });
  }
  return found;
}

/* A tool namespace is the one mechanical evidence of scope in a guide body: forge's own tools are
   global by definition, and a foreign one names the integration the guide is really about. */
const FOREIGN_TOOL = /mcp__(?!forge__)([a-z0-9_]+?)__/gu;

/** Guides declared globally whose body only makes sense for one project. */
export function misScoped(guides) {
  const found = [];
  for (const guide of guides) {
    const vendors = new Set([...String(guide.body ?? "").matchAll(FOREIGN_TOOL)].map((m) => m[1]));
    if (vendors.size) found.push({ slug: guide.slug, evidence: [...vendors].sort() });
  }
  return found;
}

/* A superseded guide is no authority, so its sentences are scored against nothing. */
const guideUnits = (guides, superseded) =>
  guides
    .filter((guide) => !superseded.has(guide.slug))
    .flatMap((guide) =>
      statements(String(guide.body ?? "")).map(([, sentence]) => [guide.slug, sentence]),
    );

/** Pure over its inputs: `guides` is data, so nothing here reaches the network. */
export function reviewClaudeMd(text, guides, options = {}) {
  const {
    threshold = GUIDE_OVERLAP_THRESHOLD,
    floor = GUIDE_OVERLAP_FLOOR,
    superseded = new Set(),
  } = options;
  const known = new Set(guides.map((guide) => guide.slug));
  const markers = overrideMarkers(text);
  const claimed = (span, slug) =>
    markers.some((m) => m.slug === slug && m.line >= span.start && m.line <= span.end);

  const overlaps = [];
  const seen = new Set();
  for (const [score, [span, ours], [slug, theirs]] of findOverlapsAgainst(
    statements(text),
    guideUnits(guides, superseded),
    { threshold, floor },
  )) {
    const key = `${slug}\0${theirs}\0${span.start}\0${ours}`;
    if (seen.has(key) || claimed(span, slug)) continue;
    seen.add(key);
    overlaps.push({ score, slug, theirs, line: span.start, ours });
  }
  return {
    overlaps,
    overrides: markers.map((m) => ({ ...m, known: known.has(m.slug) })),
    misScoped: misScoped(guides),
  };
}

const readDir = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};

/* Read-only, and each allowed to fail: a repo with no git is not a finding about CLAUDE.md. */
const ran = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, encoding: "utf8", stdio: "pipe" });
const ignored = (root, rel) => ran("git", ["check-ignore", "-q", rel], root).status === 0;
const resolvesRef = (root, ref) => ran("git", ["rev-parse", "--verify", "--quiet", ref], root).status === 0;
const onPath = (name) => ran("sh", ["-c", `command -v ${name}`]).status === 0;

const readText = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

const readJson = (path) => {
  const text = readText(path);
  try {
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
};

/** The project root's own CLAUDE.md, or null. Nested ones are another scope and are not read. */
export function readClaudeMd(root) {
  if (!root) return null;
  const path = join(root, "CLAUDE.md");
  if (!existsSync(path)) return null;
  try {
    return { path, text: readFileSync(path, "utf8") };
  } catch {
    return null;
  }
}

/* Claims about the repo, which are the ones that rot silently: a path that was renamed, a script
   that lost its entry, a `-h` nobody wired. Each of the three found a live defect in sid-erp on
   the day it was written. Backticks and link targets only — prose naming a file is not a claim. */
const CODE_SPAN = /`([^`\n]+)`/g;
const LINK_TARGET = new RegExp(LINK_TARGET_PATTERN, "gu");
const NPM_SCRIPT = /\bnpm (?:run ([\w:-]+)|(test)\b)/g;
/* Two shapes of "ask it with -h": a script this repo holds, and a command on PATH. */
const SCRIPT_HELP = /`([\w./-]+\.(?:mjs|js|sh|py))\s+(?:-h|--help)`/g;
const TOOL_HELP = /`([a-z][\w-]*)\s+(?:-h|--help)`/g;
const GIT_REF = /`((?:origin|upstream)\/[\w.\/-]+)`/g;
const SHA = /`([0-9a-f]{7,40})`/g;

/* An absence is a claim, and the strongest kind — "there is no `backend/.env` and there must not be
   one" is falsified by the file EXISTING. Read the other way round it reports backwards. */
const FORBIDDEN = /there (?:is|are) no `([^`\n]+)`/gi;

/* Identifiers the documents are organised by. Three projects state the rule themselves: a cited
   identifier must exist. */
const CITED = /\b((?:FR|UC|BR|NFR|AC|HC|ISS|SPEC|A|D)-\d[\w-]*)\b/g;

/* A placeholder, a glob, a package name and a url are not paths this repo owns. */
const NOT_A_PATH = /[<>*$…{}\s]|^https?:|^@|^~/u;
const PATHISH = /^[\w.@-]+(?:\/[\w.@-]+)+\/?$|^[\w.-]+\.(?:mjs|js|ts|tsx|json|md|sql|ya?ml)$/u;

/* Shaped like a path and not one — each measured as a false positive over 28 real CLAUDE.md files:
   a CIDR block, a date mask, a bare extension used as a noun, a git ref, a build directory. */
const LOOKS_LIKE = [
  /^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/u,
  /^(?:dd|mm|yy|yyyy|hh|ss|DD|MM|YY|YYYY)[\/.-]/u,
  /^\.[\w.]+$/u,
  /^(?:origin|upstream|HEAD|refs)\//u,
  /\/\d+$/u,
  /(?:^|\/)(?:\.next|dist|build|coverage|target|__pycache__)\/?$/u,
];

/* A rule with a checker is documented by the checker's own message. Names come from the configs the
   project actually loads, so this cannot claim a rule that was renamed or removed. */
const CONFIG_RULE = /["']([a-z][\w-]*(?:\/[\w-]+)?)["']\s*:\s*(?:["'](?:error|warn)["']|\[)/g;
const DECLARED_RULE = /["']([a-z][a-z\d]*(?:-[a-z\d]+)*)["']/g;
const CONFIG_FILE = /^(?:eslint\.config\.[cm]?js|\.eslintrc(?:\.\w+)?)$/u;
/* A checker declares its own rule names, and no two projects keep them in the same place: an eslint
   config, a `rules/` directory, a gate script. A name quoted anywhere else is just a string. */
const CHECKER_FILE = /^(?:check-[\w-]+|gates)\.[cm]?js$/u;
const RULE_TOKEN = /^[a-z][a-z\d]*(?:-[a-z\d]+)*$/u;

const spans = (text) => {
  const out = new Set();
  for (const [, inner] of text.matchAll(CODE_SPAN)) out.add(inner.trim());
  for (const [, target] of text.matchAll(LINK_TARGET)) out.add(target.trim());
  return out;
};

const uniq = (text, pattern) => [...new Set([...text.matchAll(pattern)].map((m) => m[1]))].sort();

/** Everything the file asserts about the tree it sits in, as data. */
export function claims(text) {
  const paths = [...spans(text)]
    .filter((t) => !NOT_A_PATH.test(t) && PATHISH.test(t) && !LOOKS_LIKE.some((rx) => rx.test(t)))
    .sort();
  const scripts = [...new Set([...text.matchAll(NPM_SCRIPT)].map((m) => m[1] ?? m[2]))].sort();
  const helps = uniq(text, SCRIPT_HELP);
  const tools = uniq(text, TOOL_HELP).filter((name) => !helps.includes(name) && name !== "npm");
  const forbidden = uniq(text, FORBIDDEN);
  return {
    paths: paths.filter((rel) => !forbidden.includes(rel)),
    scripts,
    helps,
    tools,
    forbidden,
    refs: uniq(text, GIT_REF),
    shas: uniq(text, SHA),
    cited: uniq(text, CITED),
  };
}

/* Every package.json the project holds, found rather than guessed: a list of workspace directories
   is one repo's layout, and this runs in any of them. Bounded, because a monorepo is wide. */
const packageScripts = (root) => {
  const names = new Set();
  const visit = (dir, depth) => {
    for (const name of Object.keys(readJson(join(dir, "package.json"))?.scripts ?? {})) {
      names.add(name);
    }
    if (depth === 0) return;
    for (const entry of readDir(dir)) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        visit(join(dir, entry.name), depth - 1);
      }
    }
  };
  visit(root, 3);
  return names;
};

/* Dangling and imprecise deserve different weight: `<project>/lib/formatters.ts` against
   `<project>/dashboard/frontend/src/lib/utils/formatters.ts` is stale, not missing — the read tree's. */
const basenames = (root) => {
  const found = new Set();
  const visit = (dir, depth) => {
    for (const entry of readDir(dir)) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      found.add(entry.name);
      if (depth > 0 && entry.isDirectory()) visit(join(dir, entry.name), depth - 1);
    }
  };
  visit(root, 6);
  return found;
};

/** Reads the tree; `root` is the only input, so a test points it at a fixture. */
/* One sweep, not a subprocess per citation. `grep -r` and not `git grep`, which skips ignored files. */
const definedIdentifiers = (root) => {
  const run = ran("grep", ["-rhoE", "(FR|UC|BR|NFR|AC|HC|ISS|SPEC|A|D)-[0-9][A-Za-z0-9-]*",
    "--exclude=CLAUDE.md", "--exclude-dir=node_modules", "--exclude-dir=.git", "."], root);
  return new Set((run.stdout ?? "").split("\n").filter(Boolean));
};

/* Found rather than listed: a project keeps its checkers where it likes. */
const configuredRules = (root) => {
  const names = new Set();
  const visit = (dir, depth, inRules) => {
    for (const entry of readDir(dir)) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth > 0) visit(full, depth - 1, inRules || entry.name === "rules");
        continue;
      }
      const config = CONFIG_FILE.test(entry.name);
      if (!config && !inRules && !CHECKER_FILE.test(entry.name)) continue;
      const text = readText(full) ?? "";
      for (const [, name] of text.matchAll(config ? CONFIG_RULE : DECLARED_RULE)) names.add(name);
    }
  };
  visit(root, 4, false);
  return names;
};

/** Rules CLAUDE.md explains that a checker already enforces, with the line each sits on. */
export function checkerOwned(text, root) {
  const named = [...spans(text)].filter((token) => RULE_TOKEN.test(token) && token.includes("-"));
  if (!named.length) return [];
  const configured = configuredRules(root);
  const owned = named.filter((name) => configured.has(name));
  const at = new Map();
  for (const [index, line] of text.split("\n").entries()) {
    for (const name of owned) if (!at.has(name) && line.includes(`\`${name}\``)) at.set(name, index + 1);
  }
  return owned.map((rule) => ({ rule, line: at.get(rule) ?? 0 })).sort((a, b) => a.line - b.line);
}

/* `checkerOwned` catches a rule named in backticks; one written out in prose is the half that rots,
   because nothing fails when a checker appears underneath it later. */
export function checkerRestated(text, root) {
  const units = load(root, new Set(), "comments");
  const out = [];
  const seen = new Set();
  for (const [score, [span, ours], [where, theirs]] of findOverlapsAgainst(statements(text), units, {
    threshold: DEFAULT_OVERLAP_THRESHOLD,
    floor: DEFAULT_OVERLAP_FLOOR,
  })) {
    const key = `${where}\0${theirs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ score, where, theirs, line: span.start, ours });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function checkClaims(text, root) {
  const { paths, scripts, helps, tools, forbidden, refs, shas, cited } = claims(text);
  const declared = packageScripts(root);
  const missingHelp = [];
  const unresolved = [];
  for (const rel of helps) {
    const source = readText(join(root, rel));
    if (source === null) unresolved.push(rel);
    else if (!/["'`](?:-h|--help)["'`]/u.test(source)) missingHelp.push(rel);
  }
  const defined = cited.length ? definedIdentifiers(root) : new Set();
  const absent = [...paths.filter((rel) => !existsSync(join(root, rel))), ...unresolved];
  const tracked = absent.filter((rel) => !ignored(root, rel));
  const known = basenames(root);
  const base = (rel) => rel.replace(/\/$/u, "").split("/").at(-1);
  return {
    missingPaths: tracked.filter((rel) => !known.has(base(rel))).sort(),
    stalePaths: tracked.filter((rel) => known.has(base(rel))).sort(),
    missingScripts: scripts.filter((name) => !declared.has(name)),
    missingHelp,
    missingTools: tools.filter((name) => !onPath(name)),
    missingRefs: refs.filter((ref) => !resolvesRef(root, ref)),
    presentForbidden: forbidden.filter((rel) => existsSync(join(root, rel))),
    strandedShas: shas.filter(
      (sha) => ran("git", ["merge-base", "--is-ancestor", sha, "HEAD"], root).status !== 0,
    ),
    uncitedIdentifiers: cited.filter((id) => !defined.has(id)),
  };
}

/* Structure against the published rules, not taste — code.claude.com/docs/en/memory. */
export const MAX_CLAUDE_MD_LINES = 200;

const IMPORT = /(^|\s)@([\w./-]+)/g;
const BULLET_LEAD = /^\s*[-*+]\s+(\*\*|__)/u;
const ANY_BULLET = /^\s*[-*+]\s+\S/u;

/* Words that signal unfinished thinking; the docs ask for what is concrete enough to verify. */
const VAGUE = /\b(?:appropriate(?:ly)?|adequate(?:ly)?|properly|as needed|if any|reasonable|clean code|best practice|significant(?:ly)?)\b/giu;

/* What the docs say a CLAUDE.md is for. Missing one is a gap to look at, never a failure: a
   library with no deploy has no deploy section. */
const EXPECTED = [
  ["commands", /`(?:npm|pnpm|yarn|make|cargo|go|uv|poetry|node|python)[ `]/u],
  ["testing", /\btests?\b|\btesting\b|\bsuite\b/iu],
  ["environment", /\.env\b|environment|env var|secret/iu],
  ["gotchas", /never|must not|do not|silent|trap|gotcha|danger/iu],
];

/* A file naming these words as an anti-pattern quotes them. One alternation and never a pass each:
   where a span and a quoted run overlap, whichever delimiter opens first has to win. */
const QUOTED = new RegExp([CODE_SPAN_PATTERN, String.raw`"[^"\n]*"`, String.raw`«[^»\n]*»`].join("|"), "gu");
const unquoted = (text) => text.replace(QUOTED, " ");

/** Pure over the text, except the imports, which have to resolve against the tree. */
export function checkStructure(text, root) {
  const lines = text.split("\n");
  const bullets = lines.filter((line) => ANY_BULLET.test(line));
  const emphasised = bullets.filter((line) => BULLET_LEAD.test(line));
  const imports = [...withoutSpans(text).matchAll(IMPORT)].map((m) => m[2]);
  return {
    lines: lines.length,
    overLineTarget: lines.length > MAX_CLAUDE_MD_LINES,
    emphasisDiluted: bullets.length >= 8 && emphasised.length / bullets.length > 0.8,
    emphasised: emphasised.length,
    bullets: bullets.length,
    vague: [...new Set([...unquoted(text).matchAll(VAGUE)].map((m) => m[0].toLowerCase()))].sort(),
    brokenImports: root ? imports.filter((rel) => !existsSync(join(root, rel))) : [],
    absentTopics: EXPECTED.filter(([, rx]) => !rx.test(text)).map(([name]) => name),
  };
}
