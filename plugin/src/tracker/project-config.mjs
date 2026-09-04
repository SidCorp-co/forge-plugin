/* What the project says about where a change goes and what it can be walked against, from the
   tracker and never re-declared in a checkout. Unread keeps today's behaviour, since no decision
   is not a decision to ship without a person. The tracker's own column names are reached by
   property access and printed nowhere — src/checks/tracker-names.mjs. docs/cli/the-project.md. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { once } from "../resolve/config.mjs";
import { keepOnFailure, projectRoot, slugIfAny } from "../resolve/settings.mjs";
import { bodyFrom } from "../resolve/payload.mjs";
import { citedIn } from "../checks/cited-paths.mjs";
import { BRIEF_SLUG, metaFrom, softEntryAt, upsertEntry, wroteLines }
  from "../tools/knowledge.mjs";
import { scoped } from "./rpc.mjs";

const CONFIG_SOURCE = "the tracker's project config";
const DEPLOY_SOURCE = "the tracker's project detail";

export const releaseFrom = (config) => ({
  staging: config?.baseBranch ?? null,
  production: config?.productionBranch ?? null,
  autoProd: config?.pipelineConfig?.autoProdDeploy === true,
  from: CONFIG_SOURCE,
});

const readable = (policy) => Boolean(policy?.staging && policy?.production);

export const waitsForPerson = (policy) => {
  if (!readable(policy)) return true;
  if (policy.staging !== policy.production) return false;
  return !policy.autoProd;
};

export const releaseLine = (policy) => {
  if (!readable(policy)) return null;
  if (policy.staging !== policy.production) {
    return ["promotion", `to ${policy.production}, ${policy.autoProd ? "automatic" : "a person's, owed"}`];
  }
  return policy.autoProd ? ["review", "none, by project config"] : null;
};

export const releaseConflict = (policy) => {
  if (!policy?.autoProd || readable(policy)) return null;
  const unset = [!policy.staging && "staging", !policy.production && "production"].filter(Boolean);
  return `production deploys are automatic and the ${unset.join(" and the ")} branch is unset, so `
    + "nothing says where a release lands: a person's look is owed until the branch is set";
};

export const releasePolicy = once(async () => {
  if (!slugIfAny()) return null;
  const answer = await scoped("forge_config", { action: "get" }, true);
  return answer?.config ? releaseFrom(answer.config) : null;
});

const HOST = /^https?:\/\//u;
const NOTES = "notes";

/* One walk serves three readers: what to print, what to withhold, what a payload must not carry. */
const leaves = (value, at = []) => {
  if (typeof value === "string") return value ? [{ at, value }] : [];
  if (Array.isArray(value)) return value.flatMap((one, index) => leaves(one, [...at, String(index)]));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, held]) => leaves(held, [...at, key]));
  }
  return [];
};

const labelOf = (at) => {
  /* An index distinguishes nothing, and `url` alone says nothing the heading does not. */
  const path = at
    .filter((one) => !/^\d+$/u.test(one))
    .map((one) => one.replace(/([a-z0-9])([A-Z])/gu, "$1 $2").toLowerCase());
  return (path.length > 1 ? path.filter((one) => one !== "url") : path).join(" · ");
};

/* User-info carries a password and a query a signed token, so a host is printed trimmed to what
   gets an agent there — citable, which is what keeps the refusal on the whole value escapable. */
const shownHost = (value) => {
  try {
    const url = new URL(value);
    const rides = url.username || url.password || url.search || url.hash;
    return rides ? `${url.origin}${url.pathname}` : value;
  } catch {
    return null;
  }
};

/** A host is told by the shape of its value, never by a list of keys: the field set grows, and a
 *  rule printing everything not named as a secret prints tomorrow's by default. So a string beside
 *  a host is not its label however much it reads like one — `testCredentials` holding a login URL
 *  is the tracker's shape, and the password beside it would print unasked. `notes` at the top is
 *  prose the schema forbids a secret in; everything else is withheld. */
export const deployFrom = (deploy) => {
  const urls = [];
  const rest = [];
  for (const one of leaves(deploy)) {
    const shown = HOST.test(one.value) ? shownHost(one.value) : null;
    if (shown) urls.push({ label: labelOf(one.at), url: shown });
    if (shown !== one.value) rest.push(one);
  }
  const isNote = (one) => one.at.length === 1 && one.at[0] === NOTES;
  return {
    urls,
    notes: rest.filter(isNote).map((one) => one.value),
    withheld: rest.filter((one) => !isNote(one)).map((one) => ({ label: labelOf(one.at), value: one.value })),
    from: DEPLOY_SOURCE,
  };
};

export const deployed = (deploy) =>
  Boolean(deploy && (deploy.urls.length || deploy.notes.length || deploy.withheld.length));

export const stagingDeploy = once(async () => {
  if (!slugIfAny()) return null;
  const answer = await scoped("forge_projects.get", {}, true);
  if (!answer?.project) return null;
  const { previewDeploy } = answer.project;
  return deployFrom(previewDeploy);
});

/* Above the length, refused wherever a payload holds it; below it, only where a field is it,
   quoting aside — a field can hold `admin`. docs/cli/the-project.md states that edge rather than more. */
const SECRET = 12;
const bare = (text) => text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

const matched = (text, withheld) =>
  withheld.find((one) => {
    if (one.value.length >= SECRET) return text.includes(one.value);
    const held = bare(one.value);
    return Boolean(held) && bare(text) === held;
  });

/** Which field of a payload carries a value this project holds as a test credential, and which
 *  credential. An empty `field` is a payload that is one string: a file's bytes have no field. */
export const credentialLeak = (data, deploy) => {
  if (!deploy?.withheld.length) return null;
  for (const one of leaves(data)) {
    const found = matched(one.value, deploy.withheld);
    if (found) return { field: one.at.join("."), credential: found.label };
  }
  return null;
};

/** The project's answer in this CLI's words, one line each with where it was read. */
export const projectLines = ({ id, policy, deploy, credentials }) => {
  const out = [`project id: ${id}  ← the slug in .forge.json`];
  if (policy) {
    const said = (held) => `${held ?? "unset on the project"}  ← ${policy.from}`;
    out.push(`staging branch: ${said(policy.staging)}`);
    out.push(`production branch: ${said(policy.production)}`);
    out.push(`production deploys on its own: ${policy.autoProd ? "yes" : "no"}  ← ${policy.from}`);
  } else out.push("release policy: the project config did not answer");
  if (!deployed(deploy)) return [...out, "staging deploy: none configured"];
  out.push(`staging deploy  ← ${deploy.from}`);
  for (const one of deploy.urls) out.push(`  ${one.label}: ${one.url}`);
  for (const one of deploy.notes) out.push(`  notes: ${one}`);
  const held = deploy.withheld;
  const asked = credentials && held.length;
  /* The without-flag wording is the issue's, and pointing at a flag the caller just used is not. */
  out.push(`  test credentials: ${held.length
    ? (asked ? "below, printed once" : "present, forge project --credentials") : "none"}`);
  if (!asked) {
    if (held.length) out.push(`  held, not printed: ${held.map((one) => one.label).join(", ")}`);
    return out;
  }
  return [...out, ...held.map((one) => `  ${one.label}: ${one.value}`)];
};

export const leakRefusal = (found, what) =>
  `${what} carries this project's ${found.credential}`
  + `${found.field ? `, at ${found.field}` : ""}. A test credential is read `
  + "at the authentication step and echoed nowhere after it — the tracker's own project-settings "
  + "guide, rule 2, and there is no delete for what the tracker has taken. Take the value out and "
  + "say where it is read instead:\n  forge project --credentials";

/* The project's brief: the one entry Phase 0 reads instead of learning the repository by hand. Its
   prose is a run's — no program reads a repository's dangers out of its README — and what the CLI
   owns is whether the files it was read from moved. docs/cli/the-brief.md. */
const BRIEF_KIND = "overview";
/* Not a flag: a brief nobody injects is one a run still has to ask for, the call it exists to remove. */
const BRIEF_INJECTION = "always";
const SOURCE_MARK = "←";
const DIGESTS = "digests";
const DIGEST_WIDTH = 16;

/** Only the tail after a line's mark is a source: the body maps the tree too, and hashing every
 *  path it cites would call the brief stale on any release that touched a module. */
export const briefSources = (body) => {
  const found = new Set();
  for (const line of String(body ?? "").split("\n")) {
    const at = line.lastIndexOf(SOURCE_MARK);
    if (at < 0) continue;
    for (const { path } of citedIn(line.slice(at + SOURCE_MARK.length))) found.add(path);
  }
  return [...found].sort();
};

/* Against the project root: this is the project's own brief, read inside the checkout it pins. */
const hashOf = (path) => {
  try {
    return createHash("sha256").update(readFileSync(join(projectRoot(), path))).digest("hex")
      .slice(0, DIGEST_WIDTH);
  } catch {
    return null;
  }
};

/** Null rather than dropped: dropped, an unresolved source reaches no reader, and a brief naming
 *  only those would report as one naming none. */
export const digestsFor = (body) =>
  Object.fromEntries(briefSources(body).map((path) => [path, hashOf(path)]));

/** `gone`: named and no longer here. `moved`: here, and not the bytes the brief was read from. */
export const staleIn = (digests) => {
  const gone = [];
  const moved = [];
  for (const [path, hash] of Object.entries(digests ?? {})) {
    const now = hashOf(path);
    if (now === null) gone.push(path);
    else if (now !== hash) moved.push(path);
  }
  return { gone, moved };
};

const NONE_STORED = [
  "project brief: none stored, so Phase 0 has this project's files and nothing else",
  "  write one: forge project --refresh <brief.md> --title <one line> --meta written-by=ISS-nn",
];

const NO_SOURCES = "  no line of this brief names a source, so nothing was hashed and no later run "
  + "can be told which of them moved";

/** A read the store refused is never printed as an absence: a run that took it for one would write
 *  over a brief it never saw. */
export const briefLines = (read) => {
  if (!read) return [];
  if (read.refused) {
    return [`project brief: the store would not answer, so this is not an absence — ${read.refused}`];
  }
  if (!read.entry) return NONE_STORED;
  const digests = read.entry.metadata?.[DIGESTS] ?? {};
  const { gone, moved } = staleIn(digests);
  const out = [`project brief  ← the knowledge store, slug ${BRIEF_SLUG}, `
    + `written ${(read.entry.updatedAt ?? "").slice(0, 10)}`];
  if (!Object.keys(digests).length) out.push(NO_SOURCES);
  if (moved.length) {
    out.push(`  stale: ${moved.join(", ")} — moved since the brief was read. Re-read the lines `
      + "whose source is named here, and refresh those: forge project --refresh <brief.md>");
  }
  if (gone.length) {
    out.push(`  gone: ${gone.join(", ")} — named as a source and not in this checkout`);
  }
  return [...out, "", read.entry.body ?? ""];
};

export const readBrief = async () => (slugIfAny() ? softEntryAt(BRIEF_SLUG) : null);

/** One call, so no hash is freshened without a body passing through the caller's hands — which is
 *  not proof it was corrected. docs/cli/the-brief.md states that edge. */
export const refreshBrief = async (path, { pairs, ...meta }) => {
  const body = await bodyFrom(path);
  if (path === "-") keepOnFailure(`Your brief, so that nothing here loses it:\n\n${body}`);
  const digests = digestsFor(body);
  const wrote = await upsertEntry({
    slug: BRIEF_SLUG,
    body,
    kind: BRIEF_KIND,
    title: meta.title,
    injection: BRIEF_INJECTION,
    confidence: meta.confidence,
    meta: { ...metaFrom(pairs), [DIGESTS]: digests },
  });
  const named = Object.keys(digests);
  const missing = named.filter((path) => digests[path] === null);
  const hashed = named.filter((path) => digests[path] !== null);
  return [
    ...wroteLines(wrote),
    hashed.length
      ? `  digests: ${hashed.join(", ")}`
      : "  digests: none — no line of this brief names a source this checkout holds, so nothing "
        + "later can say one moved",
    ...(missing.length
      ? [`  named and not here: ${missing.join(", ")} — kept, and read back as gone until they appear`]
      : []),
  ];
};
