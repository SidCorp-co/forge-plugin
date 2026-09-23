/* What the project says about where a change goes and what it can be walked against, from the
   tracker and never re-declared in a checkout. Unread keeps today's behaviour, since no decision
   is not a decision to ship without a person. The tracker's own column names are reached by
   property access and printed nowhere — src/checks/tracker-names.mjs. docs/cli/doctor.md. */
import { once } from "../resolve/config.mjs";
import { DRAINS, RELEASE_MODES, drainScope, landingScope, releaseScope, slugIfAny }
  from "../resolve/settings.mjs";
import { NOT_STATED } from "../goals.mjs";
import { scoped } from "./rest.mjs";

const CONFIG_SOURCE = "the tracker's project config";
const DEPLOY_SOURCE = "the tracker's project detail";

/* The three release models the tracker declares, and the only place this CLI names them: `none` is
   no release step at all, `promote` moves code from the staging branch to the live branch by the
   strategy, and `publish` moves no ref and acts on a live deploy binding. A fourth word is read as
   no declaration, not as a fourth behaviour — a waiver inferred from a word nothing here understands
   is the one reading that lets a release out with nobody's hand on it. */
const MODELS = ["none", "promote", "publish"];
const [NO_RELEASE, PROMOTE] = MODELS;

const [AUTO] = RELEASE_MODES;
const RELEASE_KEY = "release";

/* A word the key does not take falls back with the rest, as every key of that file does
   (docs/two-levels.md), and is named here because this row is the only place that would otherwise
   report a value somebody wrote as an absence. */
const unsetSaid = (release) => (release.unknown === undefined
  ? `this project's own \`${RELEASE_KEY}\` key being unset`
  : `this project's own \`${RELEASE_KEY}\` key holding \`${release.unknown}\`, which is no value of `
    + `it — it takes ${RELEASE_MODES.join(", ")}`);

/* Which level answered the one switch about production, and in the words the report prints after its
   arrow. The project's own `release` key is read first and `pipelineConfig.autoProdDeploy` behind it
   — not as a second source but as the level the switch moved off (ISS-2190). A project that never set
   the key reads as it did before that move, which is why the flag is a fallback and not a twin, and
   `manual` is what neither level having spoken resolves to. */
const switchOf = (config, release) => (release.value
  ? { autoProd: release.value === AUTO, autoProdFrom: release.from }
  : { autoProd: config?.pipelineConfig?.autoProdDeploy === true,
    autoProdFrom: `${CONFIG_SOURCE}, ${unsetSaid(release)}` });

/* The live branch is the promoting model's field and no other's: the tracker serves it non-null only
   there and forbids reading it elsewhere, so it is null here wherever the model has none rather than
   whatever the row happened to carry. The strategy goes the same way, being how a promotion moves
   code and nothing where there is no promotion. `said` is what the project declared, kept so a
   refusal can name a value this CLI did not recognise instead of calling it absent. */
export const releaseFrom = (config, release = releaseScope()) => ({
  staging: config?.baseBranch ?? null,
  model: MODELS.includes(config?.releaseModel) ? config.releaseModel : null,
  said: config?.releaseModel ?? null,
  live: config?.releaseModel === PROMOTE ? config?.liveBranch ?? null : null,
  strategy: config?.releaseModel === PROMOTE ? config?.releaseStrategy ?? null : null,
  ...switchOf(config, release),
  qa: config?.pipelineConfig?.qa ?? null,
  from: CONFIG_SOURCE,
});

/* A policy is read when it declares a model this CLI knows and, where that model promotes, names the
   branch it promotes to. Nothing else is asked for: two of the three models declare no such branch,
   so a predicate that wanted one would refuse the projects whose policy is complete. */
const readable = (policy) => Boolean(policy?.model)
  && (policy.model !== PROMOTE || Boolean(policy.live));

export const UNREAD_CONFIG = "the project config could not be read";

export const unreadFrom = (why) => ({ unread: why, from: CONFIG_SOURCE });

export const policyUnread = (policy) => policy?.unread ?? null;

const firstLine = (said) => String(said).split("\n")[0];

/* Each says what the branch is and where the name came from, in one clause, because a caller prints
   it inside a sentence about that branch and a reader of a refusal has to know from it whether to
   declare a branch or to fetch a ref. */
const DECLARED_BASE = "the branch this project declares a change lands on, read off the tracker's "
  + "project config";
const RECORDED_DEFAULT = "the branch this checkout recorded as the remote's own default, this "
  + "project having declared none";

/** Which branch a landing is read against, and where that name came from. Three shapes, because two
 *  of them are not one: a project read to declare no branch a change lands on is an absence and
 *  falls back to git's record of the remote's default as this reading always did, while a project
 *  whose configuration did not read is a question nobody answered and refuses — the write that
 *  reading licenses is terminal, so a fallback there could end a landing against the branch a
 *  release promotes to rather than the one a change lands on, which is ISS-1802's defect the other
 *  way round. `from` is carried rather than derived at the caller because two sources for one
 *  reading are a precedence, and one a reader cannot see is one nobody can undo. */
export const landsOn = (policy) => {
  const why = policyUnread(policy);
  if (why) {
    return { branch: null, from: null, route: "forge doctor",
      unsettled: `${UNREAD_CONFIG}, so nothing here says which branch a change lands on, and the `
        + "branch this checkout recorded as the remote's own default is the branch a release "
        + `promotes to on a project that promotes: ${firstLine(why)}` };
  }
  if (!policy) {
    return { branch: null, from: null, route: null,
      unsettled: "this checkout names no project, so nothing here says which branch a change lands on" };
  }
  return policy.staging
    ? { branch: policy.staging, from: DECLARED_BASE, unsettled: null, route: null }
    : { branch: null, from: RECORDED_DEFAULT, unsettled: null, route: null };
};

export const QA_MODES = ["independent", "builder"];

/* Derived, never asked for again: a model that moves no ref at the release and deploys production on
   its own means a push IS the deploy, so the candidate is judged before it. Promotion lands first
   and moves the code afterwards, so the merge sits ahead of the judging there. docs/cli/doctor.md. */
const routeFrom = (policy) => {
  if (!readable(policy)) return null;
  return policy.model !== PROMOTE && policy.autoProd ? "before-merge" : "after-merge";
};

export const landingRoute = (policy, override) => {
  if (override?.value) return { value: override.value, from: override.from };
  const derived = routeFrom(policy);
  return { value: derived ?? NOT_STATED, from: policy?.from ?? CONFIG_SOURCE };
};

export const judgementOf = (policy) =>
  (QA_MODES.includes(policy?.qa) ? policy.qa : NOT_STATED);

/* Whether a person is shown the change before it goes out. A promotion is itself that showing, and a
   model declaring no release step leaves no moment before one at which anybody could be shown
   anything — so both answer no, and only a publication nobody automated waits. */
export const waitsForPerson = (policy) => {
  if (!readable(policy)) return true;
  if (policy.model === NO_RELEASE || policy.model === PROMOTE) return false;
  return !policy.autoProd;
};

/* Which of the three unread shapes a policy is in and what would end each, said once: the closing
   rung's refusal, the report's owed line and the report's own row all print this, and a second
   wording of one of them is the whole of ISS-1918. */
const unreadable = (policy) => {
  if (policy.said && !policy.model) {
    return {
      owed: `this project declares the release model \`${policy.said}\`, which this CLI does not `
        + "know, so nothing here says what a release is or whose act it would be",
      clears: `a project declaring one of ${MODELS.join(", ")} is what settles this`,
    };
  }
  if (!policy.model) {
    return {
      owed: "this project declares no release model, so nothing here says what a release is or "
        + "whose act it would be",
      clears: `a project declaring one of ${MODELS.join(", ")} is what settles this`,
    };
  }
  /* The third shape, and the only one a model this CLI knows can be in. */
  return {
    owed: "the live branch is unset under a model that promotes to it, so nothing says where a "
      + "release lands",
    clears: "a project naming the branch it promotes to, where production deploys on its own, owes a "
      + "person nothing at this rung",
  };
};

const SETTINGS_SCREEN = "; this CLI writes neither the model nor the branch, which are declared on "
  + "the tracker's own project settings screen";

const promotion = (policy) => (policy.staging
  ? `the promotion from ${policy.staging} to ${policy.live}`
  : `the promotion to ${policy.live}`);

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
    const held = unreadable(policy);
    return { owed: held.owed, clears: `${held.clears}${SETTINGS_SCREEN}` };
  }
  /* The one model that owes nobody anything here: it declares there is no release step, so a change
     that has landed and been verified is out, and the rung it would rest at is over (G-11). */
  if (policy.model === NO_RELEASE || policy.autoProd) return null;
  return {
    owed: policy.model === PROMOTE
      ? `${promotion(policy)}${policy.strategy ? `, by ${policy.strategy},` : ""} is a person's`
      : "the release is an act on this project's live deploy binding, and nothing here says it has "
        + "been made",
    clears: "a production that deploys on its own is what would take a person out of this rung",
  };
};

/** The half of that answer a reader prints on its own: what is owed, in the words every reading of this project uses for it. */
export const personOwedForRelease = (policy) => releaseOwedOf(policy)?.owed ?? null;

/* The declaration behind a policy that owes nobody, which the walk above has no branch for: it stops
   at null, and a reader handed only that cannot tell a policy this CLI read from one it never
   consulted. Built from the very details the doctor's rows print, so a reader holding the two
   readings of one project sets them side by side; the switch's row joins the model's only where the
   switch is what decided (ISS-1656). */
const nobodyOwed = (policy) => ["nobody owes this release an act. release model  "
  + modelDetail(policy), ...(policy.model === NO_RELEASE ? [] : [`production deploy  ${deployDetail(policy)}`])]
  .join("; ");

/** What the policy answers whether or not it leaves anybody an act, in one sentence: the gap and its
 *  way out where somebody is owed, the declaration that ends the rung where nobody is. */
export const releaseAnswer = (policy) => {
  const held = releaseOwedOf(policy);
  return held ? `${held.owed} — ${held.clears}` : nobodyOwed(policy);
};

export const releaseLine = (policy) => {
  if (!readable(policy)) return null;
  if (policy.model === PROMOTE) {
    return ["promotion", `to ${policy.live}, ${policy.autoProd ? "automatic" : "a person's, owed"}`];
  }
  if (policy.model === NO_RELEASE) return ["review", "none, by project config"];
  return policy.autoProd ? ["review", "none, by project config"] : null;
};

export const releaseConflict = (policy) => {
  if (!policy?.autoProd || readable(policy)) return null;
  return `production deploys are automatic and ${unreadable(policy).owed}: a person's look is owed `
    + "until that is declared";
};

/* Three states, one value each: a policy read, `null` where no project is named, and this where the
   read did not happen, said here too since a boolean reader has nowhere to put it (ISS-1663). `at`
   is handed to `releaseScope`, whose own line says what a reading aimed elsewhere needs it for.
   Memoised over the first caller's answer as the redirect above it is, one process reading one
   project. */
export const releasePolicy = once(async (at = null) => {
  if (!slugIfAny()) return null;
  const answer = await scoped("forge_config", { action: "get" }, true);
  if (answer?.config) return releaseFrom(answer.config, releaseScope(at));
  const why = answer?.refused ?? "the tracker answered for this project with no config on it";
  console.error(`release policy: ${UNREAD_CONFIG}, so every reading of it this command makes is of a `
    + `project that has declared nothing — which this one may not be: ${firstLine(why)}`);
  return unreadFrom(why);
});

const HOST = /^https?:\/\//u;

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
 *  is the tracker's shape, and the password beside it would print unasked. Everything that is not a
 *  host is withheld, prose included: the bindings carry no key a note could be read from. */
export const deployFrom = (deploy) => {
  const urls = [];
  const rest = [];
  for (const one of leaves(deploy)) {
    const shown = HOST.test(one.value) ? shownHost(one.value) : null;
    if (shown) urls.push({ label: labelOf(one.at), url: shown });
    if (shown !== one.value) rest.push(one);
  }
  return {
    urls,
    withheld: rest.map((one) => ({ label: labelOf(one.at), value: one.value })),
    from: DEPLOY_SOURCE,
  };
};

export const deployed = (deploy) => Boolean(deploy && (deploy.urls.length || deploy.withheld.length));

/* Two keys of the bindings are not the staging deploy, and they go by name: the live binding is the
   production one, whose hosts printed under a staging heading would be a false reading, and the
   limits are a blob the tracker gives a write door of its own, holding neither a host nor a
   credential. Dropped rather than the rest being picked, so a key the tracker grows next is withheld
   by the rule above rather than dropped out of the guard that reads it. */
const NOT_STAGING = new Set(["live", "limits"]);
const PREVIEW = "preview";

/** The staging half of a project's deploy bindings, under this CLI's own word for it — the label a
 *  host or a withheld value is printed under is built from these keys, and the tracker's word for
 *  the half is not one a reader of this CLI has ever been shown. The test credentials sit beside
 *  both halves rather than inside either, so they arrive here as the bindings hold them. */
export const stagingOf = (bindings) => (bindings
  ? Object.fromEntries(Object.entries(bindings)
    .filter(([key]) => !NOT_STAGING.has(key))
    .map(([key, held]) => [key === PREVIEW ? "staging" : key, held]))
  : bindings);

const NO_RECORD = "the project detail answered with no project record";

/** Null is a checkout naming no project, which holds none of a project's credentials to carry; a reading that did not answer is the deploy's own empty shape carrying `refused`, so every walker below still meets arrays and only the credential guard acts on the field (ISS-487). */
export const stagingDeploy = once(async () => {
  if (!slugIfAny()) return null;
  const answer = await scoped("forge_projects.get", {}, true);
  if (answer?.project) return deployFrom(stagingOf(answer.project.environments));
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

/* What the blank costs, per branch, because the two cost different things: the promoting model's
   branch is where the release lands and its absence is what parks the rung, while the branch a
   change lands on is what a merged mark's note reads and nothing about a release turns on it. One
   sentence for both said the park waited on the staging branch, which under a model-read policy it
   never does (consult 43e3ad F1). */
const branchRow = (label, held, from, costs) => (held
  ? { level: "ok", label, detail: `${held}  ← ${from}` }
  : { level: "note", label, detail: `${UNSET} — ${costs}` });

const NO_STAGING = "nothing says which branch a change lands on, so a merged mark has none to read "
  + "and asks for it on the write";

const NO_LIVE = "a release has no branch to land on, and the park before awaiting_release stands "
  + "until it is set";

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

/* What each model means, in this CLI's words rather than the tracker's, so a report says what the
   value costs the reader instead of handing them a word to look up. */
const MEANS = {
  none: "there is no release step, so a change that has landed and been verified is out",
  promote: "the release moves code from the staging branch to the live branch",
  publish: "the release is an act on a live deploy binding, and no branch moves",
};

const modelDetail = (policy) => `${policy.model} — ${MEANS[policy.model]}  ← ${policy.from}`;

const deployDetail = (policy) => `${policy.autoProd ? "automatic" : "a person's"} — a user-facing `
  + `change ${waitsForPerson(policy) ? "waits for" : "ships without"} a person's look  ← `
  + policy.autoProdFrom;

const modelRow = (policy) => (policy.model
  ? { level: "ok", label: "release model", detail: modelDetail(policy) }
  : { level: "note", label: "release model", detail: `${policy.said
    ? `\`${policy.said}\`, which is no model this CLI knows`
    : UNSET} — the park before awaiting_release stands until one of ${MODELS.join(", ")} is `
    + `declared  ← ${policy.from}` });

/* Under the promoting model alone: how the code moves is a field of the move, and there is no move
   under the other two. */
const strategyRow = (policy) => (policy.strategy
  ? { level: "ok", label: "release strategy", detail: `${policy.strategy}  ← ${policy.from}` }
  : { level: "note", label: "release strategy", detail: `${UNSET} — nothing says how the promotion `
    + `moves the code, and the actor making it decides  ← ${policy.from}` });

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
    modelRow(policy),
    branchRow("staging branch", policy.staging, policy.from, NO_STAGING),
    ...(policy.model === PROMOTE
      ? [branchRow("live branch", policy.live, policy.from, NO_LIVE), strategyRow(policy)]
      : []),
    /* The switch's own level and not the policy's: the model beside it is the tracker's whatever
       happens, and this one row moves between the two (ISS-2190). */
    { level: "ok", label: "production deploy", detail: deployDetail(policy) },
    { level: "ok", label: "where the merge sits", detail: `${route.value}  ← ${route.from}` },
    { level: "ok", label: "independent judgement", detail: `${judgementOf(policy)} between developed`
      + ` and testing  ← ${policy.from}` },
    ...drainRows(policy),
  ];
  if (policy.autoProd) out.push({ level: "ok", label: "", detail: NOTHING_DEPLOYS });
  const said = releaseConflict(policy);
  return said ? [...out, { level: "miss", label: "release policy", detail: said }] : out;
};

/** The hosts, one row each, in the shape the report and the project's record both print. */
export const deployRows = (deploy) =>
  deploy.urls.map((one) => ({ level: "ok", label: one.label, detail: one.url }));

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
