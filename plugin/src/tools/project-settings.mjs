/* The project's own configuration: the two typed resources the tracker keeps per project, reported
   with the source each key was read from and written one key at a time. Whose the decision is, and
   why a key is never re-declared in a checkout: docs/cli/doctor.md. */
import { fail, projectSlug } from "../resolve/settings.mjs";
import { scoped, write } from "../tracker/rpc.mjs";
import {
  briefLines,
  confirmSource,
  projectRows,
  readBrief,
  refreshBrief,
  releasePolicy,
  replaceBriefLine,
  stagingDeploy,
} from "../tracker/project-config.mjs";

const PIPELINE = "the tracker's pipeline configuration";
const FACTS = "the tracker's project facts";

export const RESOURCES = {
  pipeline: {
    said: PIPELINE,
    read: "pipeline",
    written: "set_pipeline",
    keysIn: (answer) => answer?.pipelineConfig ?? {},
    bodyFor: (key, value) => ({ [key]: value }),
    typed: true,
  },
  fact: {
    said: FACTS,
    read: "facts",
    written: "set_facts",
    keysIn: (answer) => answer?.projectFacts ?? {},
    bodyFor: (key, value) => ({ projectFacts: { [key]: value } }),
    typed: false,
  },
};

const NAMES = Object.keys(RESOURCES);

/* A pipeline key is typed and a fact is prose, so the coercion is the resource's: `enabled=false`
   arriving as the string "false" is a value the tracker's schema drops in silence. */
const valueFor = (resource, given) => {
  if (!resource.typed) return given;
  if (given === "true" || given === "false") return given === "true";
  return /^-?\d+$/u.test(given) ? Number(given) : given;
};

/** Both at once, and soft: a resource a credential cannot reach is a line saying so, never an empty
 *  key set that reads as a project having configured nothing. */
export const readSettings = async () => {
  const [pipeline, facts] = await Promise.all([
    scoped("forge_config", { action: RESOURCES.pipeline.read }, true),
    scoped("forge_config", { action: RESOURCES.fact.read }, true),
  ]);
  return { pipeline, fact: facts };
};

/* A nested value is its own width: a stage table printed whole is this report's longest line and
   says nothing a count of its keys does not. */
const shown = (value) => {
  if (value === null || value === undefined) return "unset";
  if (Array.isArray(value)) return `${value.length} entr${value.length === 1 ? "y" : "ies"}`;
  if (typeof value === "object") {
    const held = Object.keys(value);
    return held.length ? `${held.length} key(s): ${held.join(", ")}` : "none";
  }
  return String(value);
};

/* A fact is a guide a whole prompt carries, so its width and whether it is injected are what a
   reader acts on; the body itself is the tracker's to hand to an agent. */
const factShown = (text, config) =>
  `${String(text ?? "").length} characters${config?.alwaysInject === true ? ", always-inject" : ""}`;

export const settingRows = (read) => {
  const out = [];
  for (const name of NAMES) {
    const resource = RESOURCES[name];
    const answer = read[name];
    if (answer?.refused) {
      out.push({ level: "note", label: name, detail: `${resource.said} would not answer: ${answer.refused}` });
      continue;
    }
    const keys = resource.keysIn(answer);
    const held = Object.keys(keys).sort();
    if (!held.length) {
      out.push({ level: "ok", label: name, detail: `nothing set  ← ${resource.said}` });
      continue;
    }
    for (const key of held) {
      const detail = name === "fact"
        ? factShown(keys[key], answer?.projectFactsConfig?.[key])
        : shown(keys[key]);
      out.push({ level: "ok", label: `${name}.${key}`, detail: `${detail}  ← ${resource.said}` });
    }
  }
  return out;
};

export const SET_USAGE = "forge doctor --set <key>=<value>";

const keySets = (read) =>
  NAMES.map((name) =>
    `${name}: ${Object.keys(RESOURCES[name].keysIn(read[name])).sort().join(", ") || "nothing set"}`);

/* A bare key belongs to whichever resource already answered with it; a prefixed one names its
   resource outright, which is the only way to write a key the project does not hold yet — and the
   only way to write one both hold, because a bare key two resources answer with routes nowhere: one
   of the two is a deploy switch and picking for the caller is picking wrong half the time. */
const routeFor = (given, read) => {
  const at = given.indexOf(".");
  const head = at > 0 ? given.slice(0, at) : null;
  if (head && NAMES.includes(head)) return { name: head, key: given.slice(at + 1) };
  const found = NAMES.filter((name) => Object.hasOwn(RESOURCES[name].keysIn(read[name]), given));
  if (found.length > 1) return { both: found, key: given };
  return found.length ? { name: found[0], key: given } : null;
};

const ambiguous = (given, both) =>
  `--set: \`${given}\` is a key ${both.join(" and ")} both hold, so a bare name says nothing about `
  + `which one to write and nothing was sent. Name the resource: `
  + both.map((name) => `--set ${name}.${given}=<value>`).join(" or ");

const unknownKey = (given, read) =>
  `--set: \`${given}\` is no key either of this project's configuration resources holds, so nothing `
  + `was sent.\n  ${keySets(read).join("\n  ")}\n`
  + "Name the resource to write a key neither holds yet: "
  + NAMES.map((name) => `--set ${name}.${given}=<value>`).join(" or ");

/** Read back off the resource's own route before it is reported set: this tracker's pipeline schema
 *  drops a key it does not declare, so a write that answered 200 and kept nothing would print as a
 *  setting that took. */
export const writeSetting = async (given) => {
  /* Before the read and before the write: a checkout naming no project has nowhere to send this. */
  projectSlug();
  const at = given.indexOf("=");
  if (at < 1) {
    fail(`--set takes one key and its value, joined by \`=\`, and \`${given}\` is not that pair. `
      + `Nothing was sent: ${SET_USAGE}`);
  }
  const asked = given.slice(0, at);
  const raw = given.slice(at + 1);
  const read = await readSettings();
  const refused = NAMES.filter((name) => read[name]?.refused);
  if (refused.length) {
    fail(`--set: ${refused.map((name) => RESOURCES[name].said).join(" and ")} would not answer, and a `
      + `key is routed by which resource holds it, so nothing was sent: ${read[refused[0]].refused}`);
  }
  const route = routeFor(asked, read);
  if (!route) fail(unknownKey(asked, read));
  if (route.both) fail(ambiguous(asked, route.both));
  if (!route.key) fail(`--set: \`${asked}\` names the resource and no key of it. ${SET_USAGE}`);
  const resource = RESOURCES[route.name];
  const value = valueFor(resource, raw);
  await write("forge_config", { action: resource.written, data: resource.bodyFor(route.key, value) });
  const now = await scoped("forge_config", { action: resource.read }, true);
  if (now?.refused) {
    fail(`--set: ${route.name}.${route.key} was sent and ${resource.said} would not answer the read `
      + `back, so nothing here can say what it now holds: ${now.refused}`);
  }
  const kept = resource.keysIn(now)[route.key];
  if (String(kept) !== String(value)) {
    fail(`--set: ${route.name}.${route.key} was sent as ${JSON.stringify(value)} and ${resource.said} `
      + `reads back ${JSON.stringify(kept ?? null)}. The tracker did not keep it — a key its own `
      + "schema does not declare is dropped on the way in, and this is that key.");
  }
  return [`${route.name}.${route.key}: ${shown(kept)}  ← ${resource.said}`];
};

/** Every level of the project's own record in one reading: the branches and the deploy, then each
 *  key of the two configuration resources, then the brief as prose. The four reads go together —
 *  one report is one round trip's worth of waiting, not four. */
export const projectReport = async ({ credentials } = {}) => {
  const [policy, deploy, settings, brief] = await Promise.all([
    releasePolicy(), stagingDeploy(), readSettings(), readBrief(),
  ]);
  return {
    rows: [...projectRows({ policy, deploy, credentials }), ...settingRows(settings)],
    brief: briefLines(brief),
  };
};

/* Three ways to write one brief entry, and a call takes one: silently preferring a route would leave
   the caller reading a success about the write they did not ask for. The body's fields are refused
   beside a narrow write rather than ignored, since the narrow writes carry them forward untouched. */
const WRITES = ["refresh", "confirm", "line"];
const WITH_BODY = ["title", "confidence"];

export const briefAsked = (asked) => WRITES.some((one) => asked[one] !== undefined);

export const briefRoute = async (asked, pairs, positionals) => {
  const asks = WRITES.filter((one) => asked[one] !== undefined);
  if (asks.length > 1) {
    fail(`doctor: ${asks.map((one) => `--${one}`).join(" and ")} each write the brief a different `
      + "way and one call takes one — --refresh the whole body, --confirm one source's digest, "
      + "--line one line's prose.");
  }
  const carried = [...WITH_BODY.filter((one) => asked[one] !== undefined), ...(pairs.length ? ["meta"] : [])];
  if (carried.length && asks.length && asks[0] !== "refresh") {
    fail(`doctor: ${carried.map((one) => `--${one}`).join(" and ")} are written with a body, so `
      + `they belong to --refresh. --${asks[0]} carries the stored entry's forward untouched.`);
  }
  if (asked.line !== undefined && positionals.length !== 1) {
    fail("doctor: --line takes the line's number and the one line of prose replacing it, so quote "
      + `that prose as a single argument: forge doctor --line <n> <text>${positionals.length
        ? ` — ${positionals.length} arrived after it` : ""}`);
  }
  if (asked.confirm !== undefined) return confirmSource(asked.confirm);
  if (asked.line !== undefined) return replaceBriefLine(asked.line, positionals[0]);
  return refreshBrief(asked.refresh, { ...asked, pairs });
};

/** The dozen lines a usage row cannot hold: a reader who has to be told what a `stale:` line means
 *  before they can act on one is a reader the row has already lost. */
export const PROJECT_USAGE = [
  "",
  "The project's own record prints beside this machine's keys — the branches a change lands on, the",
  "staging deploy, each key of the pipeline configuration and the project facts, and the brief Phase",
  "0 reads instead of learning the repository by hand.",
  "",
  `  --set <key>=<value>  one key of the project's configuration, written through the route of the`,
  "                       resource that holds it and read back off it before it reports set. A key",
  "                       neither resource holds is refused; `pipeline.<k>` and `fact.<k>` name one",
  "                       outright, which is how a key the project has not got yet is created.",
  "  --credentials        the test credentials the deploy lines withhold, printed once.",
  "",
  "The brief prints with a `stale:` line naming which of the files it was read from have moved",
  "since. Nothing here writes the brief's prose, because no program reads a repository's dangers",
  "out of its README — so a stale line is judged by a run and closed by whichever of these it is:",
  "",
  "  --confirm <source>   the lines naming that source were read against the file as it now is",
  "                       and their prose still holds, so the digest alone is re-stamped and the",
  "                       body goes back byte for byte. The lines it covered are printed.",
  "  --line <n> <text>    one line's prose, replaced. A digest is a path's and not a line's, so a",
  "                       source another line also reads is left stale and that line is named.",
  "  --refresh <body>     the whole brief, for one being rewritten on purpose. Its digests are",
  "                       stamped from that same body in the same call.",
  "",
  "The entry is `forge knowledge`'s in every other respect — one slug, `project-brief`, kind",
  "`overview`, injection `always` — and --title, --confidence and --meta mean there what they mean",
  "here. Injection is not a flag: a brief a session has to ask for is the call this entry removes.",
].join("\n");
