/* Where the instance, its token and this checkout's project pin come from: the credential from
   this CLI's own configuration, the pin from this machine's record of the project the checkout
   belongs to, which `forge coolify pin` writes. docs/cli/coolify-the-instance.md. */
import { configPath, userConfig } from "../../../resolve/config.mjs";
import { fail, projectCoolify, projectFilePath } from "../../../resolve/settings.mjs";

export const NO_TARGET =
  "No Coolify instance is configured. Save one with\n"
  + "  forge coolify login --url https://coolify.example.com --token <api-token>";

/** The two forms that write a pin, and the call that lists what one could name. It reads the
 *  instance and nothing pinned, so every refusal about a pin can name it: it answers in exactly the
 *  states those refusals fire in. */
export const PIN_FORMS = [
  "  forge coolify pin --app <name|uuid>                              its project and its environment",
  "  forge coolify pin --project <name|uuid> [--environment <name>]   a project, narrowed or not",
];
export const PIN_WAYS = [...PIN_FORMS, "  forge coolify pin, with neither, lists the projects this token can see"];

/* One value or several, spelled either way round, so two projects pin as cheaply as one. */
const asList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(asList);
  return String(value).split(",").map((one) => one.trim()).filter(Boolean);
};

const SCOPE_KEYS = ["project_uuid", "environment"];

/** The pin and the file it was read from. `at` is null where no project is pinned, which includes a
 *  directory in no checkout: a flag or a variable that could retarget it would follow you into
 *  every directory, which is the ambient scope the guard exists to prevent. */
export const pinned = () => {
  const held = projectCoolify();
  const spec = {};
  for (const key of SCOPE_KEYS) {
    const values = asList(held[key]);
    if (values.length) spec[key] = values;
  }
  return { at: spec.project_uuid ? projectFilePath() : null, record: projectFilePath(), spec };
};

/* The base path, appended where the saved URL stops at the host — which is what a browser gives. */
const withBase = (raw) => {
  const trimmed = raw.replace(/\/+$/u, "");
  const schemed = /^https?:\/\//u.test(trimmed) ? trimmed : `https://${trimmed}`;
  return schemed.endsWith("/api/v1") ? schemed : `${schemed}/api/v1`;
};

export const coolifyTarget = () => {
  const saved = userConfig().coolify ?? {};
  if (!saved.url || !saved.apiToken) return { url: null, token: null, from: null };
  return { url: withBase(saved.url), token: saved.apiToken, from: configPath() };
};


/** The saved instance, or the refusal naming the command that saves one. */
export const configured = () => {
  const target = coolifyTarget();
  if (!target.url) fail(NO_TARGET);
  return target;
};
