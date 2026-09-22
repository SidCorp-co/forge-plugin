/* The keys `forge doctor` writes: a report is every finding at once, a write is one key. docs/cli/doctor.md. */
import { readJson, saveNested, saveConfig } from "../resolve/config.mjs";
import { STORES } from "../resolve/machine/stores.mjs";
import { keyLabel, keySaid } from "./services/doctor/harness.mjs";
import { fromProject, JOB_ALL, SHIP_MODES, declaredJobs, fail } from "../resolve/settings.mjs";
import { INSTANCE, ROUTE_KEY, ROUTE_MODES, TRACKER } from "./services/coolify/chosen-route.mjs";
import { didYouMean } from "../suggest.mjs";
import { HIDDEN, OFF, VERB_NAMES, shippedSkills, skillsWithheldForJob, verbStates,
  withheldForJob } from "../resolve/visibility.mjs";

const SAVED = ["token", "url"];

const given = (asked, flags) => Object.fromEntries(
  flags.filter((flag) => asked[flag] !== undefined).map((flag) => [flag, asked[flag]]),
);

const install = (values) => {
  const written = saveConfig(values);
  console.log(`Saved ${Object.keys(values).join(" and ")} to ${written} (mode 0600).\n`);
};

/* Blank is a key written and never read back, so it is refused before the write and the file stands. */
const refuseBlank = (store, named, asked) => {
  const empty = named.filter((row) => !String(asked[row.flag]).trim());
  if (empty.length) {
    fail(`doctor: --${empty[0].flag} was given nothing, and a blank ${empty[0].asks} is a key every `
      + `reader passes over rather than one that unsets anything. Nothing was written: give it the `
      + `${empty[0].asks}, or remove \`${store.store}.${empty[0].key}\` from the file by hand.`);
  }
};

/* Off the disk and not off the object this call merged, that being the one reading which tells a
   write from the value a reader takes; a credential is reported by its shape. */
const setStore = (store) => (asked) => {
  const named = store.keys.filter((row) => asked[row.flag] !== undefined);
  refuseBlank(store, named, asked);
  const written = saveNested(store.store, Object.fromEntries(named.map((row) => [row.key, asked[row.flag]])));
  const back = readJson(written)?.[store.store] ?? {};
  const wrong = named.filter((row) => back[row.key] !== asked[row.flag]);
  if (wrong.length) {
    fail(`doctor: ${store.label} ${wrong.map((row) => row.key).join(" and ")} was written to ${written} `
      + "and that file does not read it back, so nothing here can say what this machine now holds. "
      + "Read it: `forge doctor services`");
  }
  const shown = named.map((row) => `  ${keyLabel({ ...row, label: store.label })}  `
    + `${keySaid({ ...row, value: back[row.key], from: written }, false)}`);
  console.log(`Saved (mode 0600), which the file now reads back as:\n${shown.join("\n")}\n`);
};

/* One verb at a time is the person's own tidying and stays reachable by hand, so this writes the
   state a job does not. Either way the whole map is written back, which is what turns a list an
   older release left behind into the shape every reader now takes. */
const setVisibility = (verb, hide) => {
  if (!VERB_NAMES.includes(verb)) fail(didYouMean("verb", verb, VERB_NAMES));
  const withheld = verbStates();
  if (hide) withheld[verb] = HIDDEN;
  else delete withheld[verb];
  saveConfig({ withheld });
  console.log(hide
    ? `${verb} is now hidden from the usage list, and still runs when it is typed.\n`
    : `${verb} is now offered in the usage list.\n`);
};

const refuseUnknown = (name, named, known, said) => {
  const unknown = named.filter((one) => !known.includes(one));
  if (unknown.length) {
    fail(`doctor: the \`${name}\` job in ${fromProject()} names ${unknown.join(", ")}, ${said}`);
  }
};

/* One call over the switch `--hide` writes a verb at a time, and a REPLACEMENT rather than an
   addition, so turning a job on is the same act whatever this machine held before it. The array it
   writes is the machine's while the declarations are one project's, so it reaches every checkout on
   this box, and the line says so. docs/cli/a-job.md. */
const setJob = (name) => {
  if (name === JOB_ALL) {
    saveConfig({ withheld: {}, withheldSkills: [] });
    console.log("Every verb and skill this machine withheld is offered again,"
      + " including any verb hidden one at a time.\n");
    return;
  }
  const { jobs } = declaredJobs();
  const names = Object.keys(jobs);
  if (!names.length) {
    fail(`doctor: no job is declared here. A job is a name and the verbs its usage list offers, under`
      + ` \`jobs\` in ${fromProject()} — the project's own record, because which jobs exist cannot`
      + " be stated without naming the project.");
  }
  if (!Object.hasOwn(jobs, name)) fail(didYouMean("job", name, names));
  const shipped = shippedSkills();
  refuseUnknown(name, jobs[name].verbs, VERB_NAMES,
    "which this CLI has no verb for. Nothing was written; `forge -h` lists the verbs there are.");
  refuseUnknown(name, jobs[name].skills ?? [], shipped,
    "which this copy ships no skill for. Nothing was written; `forge guide` lists the ones it serves.");
  const withheld = withheldForJob(jobs[name].verbs);
  const skills = skillsWithheldForJob(jobs[name].skills, shipped);
  saveConfig({ withheld: Object.fromEntries(withheld.map((verb) => [verb, OFF])), withheldSkills: skills });
  console.log(`The usage list is at the ${name} job: ${withheld.length} verb(s) and ${skills.length} skill(s)`
    + ` off on this machine, unlisted and refused, in every checkout on it.`
    + ` \`forge doctor --job ${JOB_ALL}\` offers them all again.\n`);
};

/* Whose the option is, and why: `shipMode` in resolve/settings.mjs. */
const setShip = (mode) => {
  if (!SHIP_MODES.includes(mode)) fail(didYouMean("--ship mode", mode, SHIP_MODES));
  saveConfig({ ship: mode });
  console.log(mode === "ready"
    ? "A run on this machine now ends at a pushed branch and a landing checkpoint; the landing is another actor's.\n"
    : "A run on this machine now lands its own change, as it did before the option existed.\n");
};

/* Whose the option is: the two ways to the deployment platform in `services/coolify/chosen-route.mjs`. */
const setCoolifyRoute = (mode) => {
  if (!ROUTE_MODES.includes(mode)) fail(didYouMean("--coolify-route mode", mode, ROUTE_MODES));
  saveConfig({ [ROUTE_KEY]: mode });
  console.log(mode === INSTANCE
    ? "`forge coolify` now reaches the instance this machine saved, scoped by the project this"
      + " checkout pins.\n"
    : "`forge coolify` now reaches the tracker's own binding for the project this CLI already"
      + " names, and asks this machine for nothing else.\n");
};

/* Every flag that writes this machine's half, in the order the report spends them, and what each spends. The two-stores check that refuses a project flag beside one of these and the dispatch that makes the writes both read this table: they were two lists, and two releases in a row each added a key to one and to the other. A row owns the flags it writes together, because a pair saved in one call prints one line for it, and it guards its own value where its predecessor guarded on truthiness — an empty `--hide` wrote nothing before this table and writes nothing under it.

   `owns` is the CONFIGURATION keys the row writes, which is not the flags it is typed as: `--hide` and `--show` both write `withheld`, `--job` writes `withheld` and `withheldSkills` together, and `capabilities` is written by no flag at all. A key of this file is refused as a project key by name, so the set has to be the stored names or the refusal misses exactly the keys nobody typed (ISS-1403). `route` is what a caller is told to run instead. */
export const MACHINE_WRITES = [
  { flags: ["job"], owns: ["withheld", "withheldSkills"], route: "forge doctor --job <name|all>",
    write: (asked) => asked.job && setJob(asked.job) },
  { flags: ["hide"], owns: ["withheld"], route: "forge doctor --hide <verb>",
    write: (asked) => asked.hide && setVisibility(asked.hide, true) },
  { flags: ["show"], owns: [], route: "forge doctor --show <verb>",
    write: (asked) => asked.show && setVisibility(asked.show, false) },
  { flags: ["ship"], owns: ["ship"], route: "forge doctor --ship ready|self",
    write: (asked) => asked.ship && setShip(asked.ship) },
  { flags: ["coolify-route"], owns: [ROUTE_KEY],
    route: `forge doctor --coolify-route ${TRACKER}|${INSTANCE}`,
    write: (asked) => asked["coolify-route"] && setCoolifyRoute(asked["coolify-route"]) },
  { flags: SAVED, owns: SAVED, route: "forge doctor --token <pat> --url <endpoint>",
    write: (asked) => install(given(asked, SAVED)) },
  ...STORES.map((store) => ({
    flags: store.keys.map((row) => row.flag),
    owns: [store.store],
    route: `forge doctor ${store.keys.map((row) => `--${row.flag} <${row.asks}>`).join(" ")}`,
    write: setStore(store),
  })),
];

export const MACHINE_FLAGS = MACHINE_WRITES.flatMap((row) => row.flags);

/* Written by no flag: `forge doctor tracker` records what a declared capability answered when it
   was called, so the key is this machine's and the route to it is making the call again. */
const RECORDED = [
  { owns: ["capabilities"], route: "forge doctor tracker, which records what each one answered" },
  { owns: ["hooksOff"], route: "forge hooks --off <hook>" },
  { owns: ["waitSeconds"], route: "forge doctor, which names the deadline and where it was read" },
  { owns: ["retrySeconds"], route: "forge doctor, which names the retry ladder and where it was read" },
  { owns: ["cloudflare"], route: "forge cloudflare, which holds its own accounts" },
  { owns: ["coolify"], route: "forge coolify login" },
];

/** Every configuration key this machine owns outright, with the route that writes each. Derived
 *  from the rows above rather than listed a second time: a key added to a row is in this set the
 *  same release, which two hand-kept lists were not. */
export const MACHINE_KEYS = Object.fromEntries(
  [...MACHINE_WRITES, ...RECORDED].flatMap((row) => row.owns.map((key) => [key, row.route])),
);

export const MACHINE_KEY_NAMES = Object.keys(MACHINE_KEYS).sort();

/* The project's half, beside the machine's: the refusal keeping a call to one store reads both, and reading them here is what keeps the module that writes them a dynamic import. What each writes is `forge doctor brief -h`'s. */
export const WRITES = ["refresh", "confirm", "line"];
export const WITH_BODY = ["title", "confidence"];
