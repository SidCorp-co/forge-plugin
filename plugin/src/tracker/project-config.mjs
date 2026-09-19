/* What the project says about where a change goes and what it can be walked against, from the
   tracker and never re-declared in a checkout. Unread keeps today's behaviour, since no decision
   is not a decision to ship without a person. The tracker's own column names are reached by
   property access and printed nowhere — src/checks/tracker-names.mjs. docs/cli/doctor.md. */
import { once } from "../resolve/config.mjs";
import { DRAINS, drainScope, landingScope, slugIfAny } from "../resolve/settings.mjs";
import { NOT_STATED } from "../goals.mjs";
import { scoped } from "./rest.mjs";

const CONFIG_SOURCE = "the tracker's project config";
const DEPLOY_SOURCE = "the tracker's project detail";

export const releaseFrom = (config) => ({
  staging: config?.baseBranch ?? null,
  production: config?.productionBranch ?? null,
  autoProd: config?.pipelineConfig?.autoProdDeploy === true,
  qa: config?.pipelineConfig?.qa ?? null,
  from: CONFIG_SOURCE,
});

const readable = (policy) => Boolean(policy?.staging && policy?.production);

export const UNREAD_CONFIG = "the project config could not be read";

export const unreadFrom = (why) => ({ unread: why, from: CONFIG_SOURCE });

export const policyUnread = (policy) => policy?.unread ?? null;

const firstLine = (said) => String(said).split("\n")[0];

export const QA_MODES = ["independent", "builder"];

/* Derived, never asked for again: one branch deploying production means a push IS the deploy, so the
   candidate is judged before it. docs/cli/doctor.md. */
const routeFrom = (policy) => {
  if (!readable(policy)) return null;
  return policy.staging === policy.production && policy.autoProd ? "before-merge" : "after-merge";
};

export const landingRoute = (policy, override) => {
  if (override?.value) return { value: override.value, from: override.from };
  const derived = routeFrom(policy);
  return { value: derived ?? NOT_STATED, from: policy?.from ?? CONFIG_SOURCE };
};

export const judgementOf = (policy) =>
  (QA_MODES.includes(policy?.qa) ? policy.qa : NOT_STATED);

export const waitsForPerson = (policy) => {
  if (!readable(policy)) return true;
  if (policy.staging !== policy.production) return false;
  return !policy.autoProd;
};

/* Which branch a policy leaves unset and what that costs, said once: two readers below answer the same question, and a reword of one would have the CLI stating one fact two ways. */
const nothingSaysWhere = (policy) => {
  const unset = [!policy.staging && "staging", !policy.production && "production"].filter(Boolean);
  return `the ${unset.join(" and the ")} branch is unset, so nothing says where a release lands`;
};

/* What a person still owes before an issue at the closing rung may close and what would take them out of it, in one walk rather than two: a refusal wording the gap differently from the report it was sent to read is the whole of ISS-1918, and two walks are where that starts. Null where nothing is owed. Not `waitsForPerson` above, which asks whether one is shown the change before it goes out and answers no for any pair of distinct branches: reading it here would close an issue whose promotion nobody had made. Silence is a person's, never an automatic release (ISS-1147). */
export const releaseOwedOf = (policy) => {
  const why = policyUnread(policy);
  if (why) {
    return {
      owed: `${UNREAD_CONFIG}, so nothing here says a release happened: ${firstLine(why)}`,
      clears: "the read answering is what settles this, and no change to the project would",
    };
  }
  if (!policy) {
    return {
      owed: "this checkout names no project, so nothing here says a release happened",
      clears: "a checkout naming its project is what settles this",
    };
  }
  if (!readable(policy)) {
    return {
      owed: nothingSaysWhere(policy),
      clears: "a project naming both branches, where production deploys on its own, owes a person "
        + "nothing at this rung; this CLI writes neither branch, which are declared on the tracker's "
        + "own project settings screen",
    };
  }
  if (policy.autoProd) return null;
  return {
    owed: policy.staging === policy.production
      ? `${policy.production} does not deploy on its own, so the release is a person's`
      : `the promotion from ${policy.staging} to ${policy.production} is a person's`,
    clears: "a production that deploys on its own is what would take a person out of this rung",
  };
};

/** The half of that answer a reader prints on its own: what is owed, in the words every reading of this project uses for it. */
export const personOwedForRelease = (policy) => releaseOwedOf(policy)?.owed ?? null;

export const releaseLine = (policy) => {
  if (!readable(policy)) return null;
  if (policy.staging !== policy.production) {
    return ["promotion", `to ${policy.production}, ${policy.autoProd ? "automatic" : "a person's, owed"}`];
  }
  return policy.autoProd ? ["review", "none, by project config"] : null;
};

export const releaseConflict = (policy) => {
  if (!policy?.autoProd || readable(policy)) return null;
  return `production deploys are automatic and ${nothingSaysWhere(policy)}: a person's look is owed `
    + "until the branch is set";
};

/* Three states, one value each: a policy read, `null` where no project is named, and this where the
   read did not happen, said here too since a boolean reader has nowhere to put it (ISS-1663). */
export const releasePolicy = once(async () => {
  if (!slugIfAny()) return null;
  const answer = await scoped("forge_config", { action: "get" }, true);
  if (answer?.config) return releaseFrom(answer.config);
  const why = answer?.refused ?? "the tracker answered for this project with no config on it";
  console.error(`release policy: ${UNREAD_CONFIG}, so every reading of it this command makes is of a `
    + `project that has declared nothing — which this one may not be: ${firstLine(why)}`);
  return unreadFrom(why);
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

const NO_RECORD = "the project detail answered with no project record";

/** Null is a checkout naming no project, which holds none of a project's credentials to carry; a reading that did not answer is the deploy's own empty shape carrying `refused`, so every walker below still meets arrays and only the credential guard acts on the field (ISS-487). */
export const stagingDeploy = once(async () => {
  if (!slugIfAny()) return null;
  const answer = await scoped("forge_projects.get", {}, true);
  if (answer?.project) return deployFrom(answer.project.previewDeploy);
  return { ...deployFrom(undefined), refused: answer?.refused ?? NO_RECORD };
});

/* Above the length, refused wherever a payload holds it; below it, only where a field is it,
   quoting aside — a field can hold `admin`. docs/cli/doctor.md states that edge rather than more. */
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

const NOTHING_DEPLOYS = "and nothing here says the host deploys on push: `awaiting_release` asks the "
  + "verification to name the deployment that built the commit this change landed at";

const NO_DEPLOY = "none configured";

const UNREAD_DEPLOY = `${DEPLOY_SOURCE} did not answer, so nothing here says what this project holds`;

const UNSET = "unset on the project";

/** One reading of `withheld`: the branches cannot disagree, and *none* is said rather than inferred from an absent line (ISS-477). */
const credentialRows = (held, asked) => {
  const out = [{ level: "ok", label: "test credentials", detail: held.length
    ? (asked ? "below, printed once" : "present, forge doctor --credentials") : "none" }];
  if (asked) return [...out, ...held.map((one) => ({ level: "ok", label: one.label, detail: one.value }))];
  if (held.length) {
    out.push({ level: "ok", label: "held, not printed", detail: held.map((one) => one.label).join(", ") });
  }
  return out;
};

const branchRow = (label, held, from) => (held
  ? { level: "ok", label, detail: `${held}  ← ${from}` }
  : { level: "note", label, detail: `${UNSET} — a release has no named ${label}, and the park before`
    + " awaiting_release stands until it is set" });

/* The other half of who judges, and the half no tracker schema declares: `qa` says whether the
   judgement is an independent run's and this says which master claims what that offers. */
const drainRows = (policy) => {
  const held = drainScope();
  const takes = `it takes ${DRAINS.join(" or ")}`;
  if (held.unknown !== undefined) {
    return [{ level: "miss", label: "drained by", detail: `\`drainedBy\` is \`${held.unknown}\`, `
      + `which is no master that drains developed: ${takes}. Nothing here says who claims this `
      + `project's issues at that status until it does  ← ${held.from}` }];
  }
  const row = { level: "ok", label: "drained by",
    detail: `${held.value} claims this project's issues at developed  ← ${held.from}` };
  if (!held.declared || judgementOf(policy) === QA_MODES[0]) return [row];
  return [row, { level: "miss", label: "drained by", detail: `\`drainedBy\` names ${held.value} and `
    + `the judgement between developed and testing is ${judgementOf(policy)}, so nothing is offered `
    + "at that status for it to drain: set the judgement to independent, or take the key out" }];
};

const policyRows = (policy, landing) => {
  const why = policyUnread(policy);
  if (why) {
    return [{ level: "miss", label: "release policy",
      detail: `${UNREAD_CONFIG}, so nothing below it was read rather than declared: ${firstLine(why)}` }];
  }
  if (!policy) {
    return [{ level: "note", label: "release policy",
      detail: "this checkout names no project, so there is no release policy to read — the park "
        + "before awaiting_release stands" }];
  }
  const route = landingRoute(policy, landing);
  const out = [
    branchRow("staging branch", policy.staging, policy.from),
    branchRow("production branch", policy.production, policy.from),
    { level: "ok", label: "production deploy", detail: `${policy.autoProd ? "automatic" : "a person's"}`
      + ` — a user-facing change ${waitsForPerson(policy) ? "waits for" : "ships without"} a person's`
      + ` look  ← ${policy.from}` },
    { level: "ok", label: "where the merge sits", detail: `${route.value}  ← ${route.from}` },
    { level: "ok", label: "independent judgement", detail: `${judgementOf(policy)} between developed`
      + ` and testing  ← ${policy.from}` },
    ...drainRows(policy),
  ];
  if (policy.autoProd) out.push({ level: "ok", label: "", detail: NOTHING_DEPLOYS });
  const said = releaseConflict(policy);
  return said ? [...out, { level: "miss", label: "release policy", detail: said }] : out;
};

/** The hosts and the notes, one row each, in the shape the report and the project's record both print. */
export const deployRows = (deploy) => [
  ...deploy.urls.map((one) => ({ level: "ok", label: one.label, detail: one.url })),
  ...deploy.notes.map((one) => ({ level: "ok", label: "notes", detail: one })),
];

/** The project's answer in this CLI's words, one row each with where it was read, in the shape the
 *  one verb reporting every level of configuration prints its own keys in. */
export const projectRows = ({ policy, deploy, credentials, landing = landingScope() }) => {
  const out = policyRows(policy, landing);
  if (deploy?.refused) {
    return [...out, { level: "note", label: "staging deploy", detail: UNREAD_DEPLOY }];
  }
  if (!deploy) return [...out, { level: "ok", label: "staging deploy", detail: NO_DEPLOY }];
  const held = deploy.withheld;
  const asked = Boolean(credentials && held.length);
  const ending = credentialRows(held, asked);
  if (!deployed(deploy)) {
    return [...out, { level: "note", label: "staging deploy", detail: policy?.staging
      ? "none on record while the staging branch is named, so the verification the rung owes cites"
        + " the branch and no running host. A host is added on the tracker's own project settings"
        + " screen: this CLI declares no route that writes one"
      : NO_DEPLOY }, ...ending];
  }
  out.push({ level: "ok", label: "staging deploy", detail: `${deploy.urls.length} host(s)  ← ${deploy.from}` });
  return [...out, ...deployRows(deploy), ...ending];
};

export const unreadRefusal = (refused, what) =>
  `${what} was not sent: this project's test credentials could not be read, so nothing here can say `
  + "whether the payload carries one, and there is no delete for what the tracker has taken. The "
  + `reading came back with: ${refused}\nSay whether the project reads, and send this again `
  + "unchanged once it does:\n  forge doctor";

export const leakRefusal = (found, what) =>
  `${what} carries this project's ${found.credential}`
  + `${found.field ? `, at ${found.field}` : ""}. A test credential is read `
  + "at the authentication step and echoed nowhere after it — the tracker's own project-settings "
  + "guide, rule 2, and there is no delete for what the tracker has taken. Take the value out and "
  + "say where it is read instead:\n  forge doctor --credentials";
