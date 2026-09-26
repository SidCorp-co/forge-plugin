/* The one way from a saved instance to a pinned checkout: a name looked up on the instance, followed
   to the project and environment holding it, and written into this machine's record of the project.
   Named forms only, since every caller is an agent with no terminal to pick from, and a pin already
   recorded is replaced only when asked. docs/cli/coolify-the-pin.md. */
import { flags } from "../../../resolve/flags.mjs";
import { fail, projectFilePath } from "../../../resolve/settings.mjs";
import { projectWrite } from "../project-file.mjs";
import { look, session } from "./client.mjs";
import { PIN_FORMS, configured, pinned } from "./config.mjs";
import { asKey, environmentsOf } from "./scope.mjs";

export const PIN_USAGE = [
  "Usage: forge coolify pin [--app A | --project P [--environment E]] [--yes] [--dry-run]",
  "Pin this checkout to a project of the saved instance, looked up by name, in this machine's",
  "record of the project. With neither --app nor --project, lists the projects this token can see.",
  "",
  "  --app A          an application's name or uuid; pins its project and its environment",
  "  --project P      a project's name or uuid",
  "  --environment E  narrow a --project pin to one of that project's environments",
  "  --yes            replace a different pin already recorded; without it that is refused",
  "  --dry-run        print the pin and the file it would go to, and write nothing",
].join("\n");

const NOTHING = "so nothing was written";

const listed = (value) => (Array.isArray(value) ? value.filter((one) => one && typeof one === "object") : []);

const nameOf = (one) => String(one?.name ?? "");

const rowOf = (one) => `    ${one.uuid}  ${nameOf(one)}`;

/* A uuid, then a whole name in any case, and never a part of one: a pin written off a guessed
   substring points the guard at somebody else's project. Names are not unique on this platform,
   so two that match are refused with the uuids that tell them apart. */
const matched = (rows, needle, noun) => {
  const exact = rows.find((one) => asKey(one.uuid) === needle);
  if (exact) return exact;
  const hits = rows.filter((one) => nameOf(one).toLowerCase() === needle.toLowerCase());
  if (hits.length > 1) {
    fail(`coolify pin: \`${needle}\` names ${hits.length} ${noun}s, ${NOTHING}. Name one by its uuid:\n`
      + `${hits.map(rowOf).join("\n")}`);
  }
  return hits[0] ?? null;
};

const projectsSeen = (projects) => (projects.length
  ? `  projects this token can see:\n${projects.map(rowOf).join("\n")}`
  : "  this token can see no project at all");

const refuseEmpty = async (held) => {
  const projects = listed(await look(held, "/projects"));
  fail(`coolify pin: nothing to go on and no terminal to ask, ${NOTHING}. Name one:\n`
    + `${PIN_FORMS.join("\n")}\n${projectsSeen(projects)}`);
};

/* The environment id is the one link from an application to where it sits, and no project names
   its applications, so every project's environments are read until one holds that id. */
const byApp = async (held, needle) => {
  const app = matched(listed(await look(held, "/applications")), needle, "application");
  if (!app) {
    fail(`coolify pin: no application this token can see is named or numbered \`${needle}\`, ${NOTHING}.\n`
      + "  forge coolify pin, with neither flag, lists the projects it can see");
  }
  const wanted = asKey(app.environment_id);
  if (wanted !== null) {
    for (const project of listed(await look(held, "/projects"))) {
      for (const environment of await environmentsOf(held, project.uuid)) {
        if (asKey(environment.id) === wanted) return { project, environment, via: `application ${nameOf(app)}` };
      }
    }
  }
  return fail(`coolify pin: application ${nameOf(app)} (${app.uuid}) answered environment `
    + `${wanted ?? "(none)"}, which no project this token can see holds, ${NOTHING}.\n`
    + "  pin its project by name instead: forge coolify pin --project <name|uuid>");
};

const byProject = async (held, needle, environmentNeedle) => {
  const projects = listed(await look(held, "/projects"));
  const project = matched(projects, needle, "project");
  if (!project) {
    fail(`coolify pin: no project this token can see is named or numbered \`${needle}\`, ${NOTHING}.\n`
      + `${projectsSeen(projects)}`);
  }
  if (environmentNeedle === undefined) return { project, environment: null, via: `project ${nameOf(project)}` };
  const environments = listed(await environmentsOf(held, project.uuid));
  const environment = matched(environments, environmentNeedle, "environment");
  if (!environment) {
    fail(`coolify pin: project ${nameOf(project)} has no environment \`${environmentNeedle}\`, ${NOTHING}.\n`
      + `  its environments: ${environments.map(nameOf).join(", ") || "(none)"}`);
  }
  return { project, environment, via: `project ${nameOf(project)}` };
};

const refuseMixed = ({ app, project, environment }) => {
  if (app !== undefined && (project !== undefined || environment !== undefined)) {
    fail(`coolify pin: --app settles the project and the environment both, so it takes neither flag beside it; ${NOTHING}.`);
  }
  if (environment !== undefined && project === undefined) {
    fail(`coolify pin: --environment narrows a --project pin and names no project by itself; ${NOTHING}.`);
  }
};

const pinOf = ({ project, environment }) => ({
  project_uuid: [String(project.uuid)],
  ...(environment ? { environment: [String(environment.name)] } : {}),
});

/* Shown and consented to, as every write of this verb is: a pin already recorded that differs is
   printed beside the one that would replace it, and replaced only under --yes. */
const settled = (found, pin, asked) => {
  const was = pinned();
  const held = was.at ? JSON.stringify(was.spec) : null;
  console.log(`${found.via} is in project ${nameOf(found.project)} (${found.project.uuid})`
    + `${found.environment ? `, environment ${nameOf(found.environment)}` : ", every environment"}`);
  if (held === JSON.stringify(pin)) {
    console.log(`already pinned to ${held}  ← ${was.at}; nothing written`);
    return false;
  }
  if (asked["dry-run"]) {
    console.log(`would pin ${JSON.stringify(pin)}  → ${was.record}${held ? `, replacing ${held}` : ""}; nothing written`);
    return false;
  }
  if (held && !asked.yes) {
    fail(`coolify pin: ${was.at} already pins ${held}, and this would replace it with ${JSON.stringify(pin)}; `
      + `${NOTHING}.\n  replace it: the same call with --yes`);
  }
  return true;
};

export const pin = async (argv) => {
  const asked = flags(argv, "coolify pin", ["--yes", "--dry-run"], { usage: PIN_USAGE });
  refuseMixed(asked);
  if (!projectFilePath()) {
    fail("coolify pin: this directory belongs to no checkout, so there is no project record to write a "
      + "pin to, and nothing was sent. Run it from inside the checkout the pin is for.");
  }
  const held = session(configured(), {});
  if (asked.app === undefined && asked.project === undefined) return refuseEmpty(held);
  const found = asked.app !== undefined
    ? await byApp(held, asked.app)
    : await byProject(held, asked.project, asked.environment);
  const next = pinOf(found);
  if (!settled(found, next, asked)) return undefined;
  const lines = projectWrite({ key: "coolifyPin", top: "coolifyPin", segments: ["coolifyPin"], name: "project",
    said: "coolify pin" }, next);
  console.log(lines.join("\n"));
  return undefined;
};
