/* What an answer looks like by the time somebody reads it: the phantom health half dropped, the
   secrets masked, and one object cut to the fields the call was made for. docs/cli/coolify.md. */
export const MASK = "<redacted>";

const SECRET_KEY =
  /password|secret|token|api[-_]?key|private[-_]?key|credential|passphrase|^.*_dsn$|database_url|redis_url|dsn$|salt|signature|webhook_url/iu;

/* `private_key_id` is an integer foreign key: masking it hides a join, not a credential. */
const IDENTIFIER = /_(?:id|uuid)$/iu;

const VALUE_FIELDS = ["value", "real_value"];

const USERINFO = /([a-zA-Z][\w+.-]*:\/\/)([^:/?#@\s]+):([^@/\s]+)@/gu;

const QUERY_SECRET = /([?&](?:token|key|secret|password|sig|signature|auth)=)[^&\s]+/giu;

const maskUrl = (value) =>
  typeof value === "string"
    ? value.replace(USERINFO, (_, scheme, user) => `${scheme}${user}:${MASK}@`).replace(QUERY_SECRET, `$1${MASK}`)
    : value;

/* The schemes whose path is a name and not a route. Over http the path is where a webhook keeps
   its secret, and such a URL can carry userinfo too — so userinfo cannot be what decides it. */
const CONNECTION = new Set(["postgres:", "postgresql:", "mysql:", "mariadb:", "redis:", "rediss:",
  "mongodb:", "mongodb+srv:", "amqp:", "amqps:", "clickhouse:"]);

/* Parsed, not matched: userinfo with no colon is a bare credential a `user:pass@` pattern reads as
   host. The host survives everywhere — which host it points at is the reading somebody came for. */
const maskedSecretUrl = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    return MASK;
  }
  const named = url.username ? `${url.password ? `${url.username}:${MASK}` : MASK}@` : "";
  const origin = `${url.protocol}//${named}${url.host}`;
  if (!CONNECTION.has(url.protocol)) return `${origin}/${MASK}`;
  return `${origin}${url.pathname}${maskUrl(url.search)}`;
};

/* Three rules, because each alone leaks: the key beside a value catches `JWT_SECRET`, the URL
   userinfo catches `DATABASE_URL`, the field's own name catches a bare `postgres_password`. */
export const redact = (data) => {
  if (Array.isArray(data)) return data.map(redact);
  if (!data || typeof data !== "object") return maskUrl(data);
  const named = typeof data.key === "string" && SECRET_KEY.test(data.key);
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    const paired = named && VALUE_FIELDS.includes(key);
    const selfNamed = SECRET_KEY.test(key) && !IDENTIFIER.test(key);
    if ((paired || selfNamed) && typeof value === "string" && value) {
      out[key] = value.includes("://") ? maskedSecretUrl(value) : MASK;
    } else {
      out[key] = redact(value);
    }
  }
  return out;
};

/* Coolify writes `<state>:<health>`, and the health half reads `unhealthy` whenever a container has
   no healthcheck at all — a fault that is not there. Only that exact word goes; every other stays. */
const strippedHealth = (key, value) => {
  if (typeof value !== "string" || !key.endsWith("status")) return value;
  const cut = value.indexOf(":");
  return cut >= 0 && value.slice(cut + 1) === "unhealthy" ? value.slice(0, cut) : value;
};

/* Before rendering, so the JSON path sees it too — the path an agent's reader most likely takes. */
export const normalize = (data) => {
  if (Array.isArray(data)) return data.map(normalize);
  if (!data || typeof data !== "object") return data;
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, strippedHealth(key, normalize(value))]));
};

/* Ninety fields in an agent's context is the leak this avoids; `resource` spans three kinds. */
export const SUMMARY_FIELDS = {
  app: ["uuid", "name", "description", "status", "fqdn", "build_pack", "git_repository", "git_branch",
    "git_commit_sha", "ports_exposes", "environment_id", "destination_id", "server_status",
    "created_at", "updated_at"],
  deployment: ["id", "deployment_uuid", "application_name", "status", "commit", "created_at", "finished_at"],
  project: ["uuid", "id", "name", "description", "environments"],
  resource: ["uuid", "name", "description", "type", "status", "fqdn", "environment_id",
    "server_status", "created_at", "updated_at"],
  env: ["uuid", "key", "value", "is_buildtime", "is_runtime", "is_shared"],
};

/* An environment variable is not the resource whose group carried it: it shares enough with an
   application to be projected against its fields and lose `key` and `value`, the two asked for. */
const groupOf = (object, group) =>
  object && typeof object === "object" && "key" in object && VALUE_FIELDS.some((one) => one in object)
    ? "env"
    : group;

/* The resource itself and not an action's reply: `app restart` answers `{"message":"ok"}`. */
const isResource = (object, group) => {
  const named = groupOf(object, group);
  if (!object || typeof object !== "object" || !Object.hasOwn(SUMMARY_FIELDS, named)) return false;
  return SUMMARY_FIELDS[named].filter((field) => field in object).length >= 3;
};

const projected = (object, group) => {
  const fields = SUMMARY_FIELDS[groupOf(object, group)];
  return Object.fromEntries(fields.filter((field) => field in object).map((field) => [field, object[field]]));
};

/* Some routes wrap their records beside a count, and the wrapper is two keys, so it is not a
   resource, so nothing was projected: one such listing answered 1.2 MB of whole build logs. */
const WRAPPERS = ["deployments", "data", "items"];

export const wrapper = (data) =>
  data && !Array.isArray(data) && typeof data === "object"
    ? WRAPPERS.find((name) => Array.isArray(data[name])) ?? null
    : null;

export const summarize = (data, group) => {
  if (Array.isArray(data)) return data.map((one) => summarize(one, group));
  const held = wrapper(data);
  if (held) return { ...data, [held]: summarize(data[held], group) };
  return isResource(data, group) ? projected(data, group) : data;
};

/** The names a summary dropped: a count says to guess, a name says what to ask for. */
export const hiddenNames = (data, shown) => {
  const inside = wrapper(data);
  const rows = inside ? data[inside] : (Array.isArray(data) ? data : [data]);
  const kept = inside ? shown[inside] : (Array.isArray(shown) ? shown : [shown]);
  const names = new Set();
  rows.forEach((row, at) => {
    if (row && typeof row === "object" && kept[at] && typeof kept[at] === "object") {
      for (const key of Object.keys(row)) if (!(key in kept[at])) names.add(key);
    }
  });
  return [...names].sort();
};

const PREFERRED = ["uuid", "id", "name", "status", "fqdn", "type", "build_pack", "git_branch",
  "key", "value", "environment_id", "created_at"];

const CELL_CUT = 60;

const flatten = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  const text = JSON.stringify(value);
  return text.length <= CELL_CUT ? text : `${text.slice(0, CELL_CUT - 1)}…`;
};

const COLUMN_CAP = 8;

export const pickColumns = (rows) => {
  const seen = new Set(rows.flatMap((row) => Object.keys(row)));
  const preferred = PREFERRED.filter((one) => seen.has(one));
  return (preferred.length ? preferred : [...seen].slice(0, 6)).slice(0, COLUMN_CAP);
};

export const renderTable = (rows, columns) => {
  const header = columns.map((one) => one.replace(/_/gu, " "));
  const body = rows.map((row) => columns.map((one) => flatten(row[one])));
  const widths = header.map((cell, at) => Math.max(cell.length, ...body.map((line) => line[at].length), 0));
  const line = (cells) => cells.map((cell, at) => cell.padEnd(widths[at])).join("  ").trimEnd();
  return [line(header), ...body.map(line)].join("\n");
};

const OBJECT_CUT = 200;

export const renderObject = (object) => {
  const keys = Object.keys(object);
  const width = Math.max(0, ...keys.map((one) => one.length));
  return keys
    .map((key) => {
      const value = object[key];
      const said = value && typeof value === "object" ? JSON.stringify(value).slice(0, OBJECT_CUT) : value;
      return `${key.padEnd(width)}  ${said === null || said === undefined ? "" : said}`;
    })
    .join("\n");
};
