/* A local stand-in for every Google endpoint the verb reaches — the APIs, the upload paths, the
   discovery directory and the token endpoint — so no case reaches Google and no credential is
   committed: the service account's key and the OAuth client are made per run, and every token the
   fake hands out is a sentinel a case can look for in what the verb printed. */
import { createHash, createVerify, generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { ranAsync, tempRoom } from "../../../fixtures.mjs";

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

export const ACCESS = "ya29.fake-access-sentinel-7c1e";
export const REFRESH = "1//fake-refresh-sentinel-4b2d";
export const CLIENT_SECRET = "GOCSPX-fake-client-secret-9a0f";
export const ENV_ACCESS = "ya29.fake-environment-sentinel-51aa";
export const DENIED = "denied@example.com";
export const LOGIN_EMAIL = "owner@example.com";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
export const PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" });
export const KEY_ID = "0123456789abcdef0123456789abcdef01234567";
/* A line from the middle of the key: the header line is the same in every key, the body is this one's. */
export const KEY_LINE = PRIVATE_KEY.split("\n")[5];

const decoded = (part) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

const verifiedClaims = (assertion) => {
  const [header, claims, signature] = assertion.split(".");
  const good = createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, "base64url"));
  return good ? { header: decoded(header), claims: decoded(claims) } : null;
};

const json = (status, body) => [status, { "Content-Type": "application/json" }, JSON.stringify(body)];

const tokenAnswer = (fake, form) => {
  const grant = form.get("grant_type");
  if (grant === "urn:ietf:params:oauth:grant-type:jwt-bearer") {
    const jwt = verifiedClaims(form.get("assertion"));
    fake.jwts.push(jwt);
    if (!jwt) return json(400, { error: "invalid_grant", error_description: "Invalid JWT Signature." });
    if (jwt.claims.sub === DENIED) return json(401, { error: "unauthorized_client", error_description: "Client is unauthorized to retrieve access tokens using this method." });
    return json(200, { access_token: ACCESS, expires_in: 3599, token_type: "Bearer" });
  }
  if (grant === "refresh_token") {
    return form.get("refresh_token") === REFRESH && form.get("client_secret") === CLIENT_SECRET
      ? json(200, { access_token: ACCESS, expires_in: 3599 })
      : json(400, { error: "invalid_grant", error_description: `bad refresh token ${form.get("refresh_token")}` });
  }
  if (grant === "authorization_code") {
    const challenge = createHash("sha256").update(form.get("code_verifier") ?? "").digest("base64url");
    if (form.get("code") !== "fake-code" || challenge !== fake.challenge) return json(400, { error: "invalid_grant" });
    const idToken = `e30.${Buffer.from(JSON.stringify({ email: LOGIN_EMAIL })).toString("base64url")}.sig`;
    return json(200, { access_token: ACCESS, refresh_token: REFRESH, id_token: idToken, expires_in: 3599 });
  }
  return json(400, { error: "unsupported_grant_type" });
};

/** The fake, listening. `answers` is keyed `METHOD /path`, each a function of the request to `[status, body]`. */
export const startFake = async () => {
  const fake = { requests: [], jwts: [], answers: {}, challenge: null };
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const url = new URL(request.url, "http://fake");
      const body = Buffer.concat(chunks);
      const seen = { method: request.method, path: url.pathname, query: url.searchParams, headers: request.headers, body, at: Date.now() };
      fake.requests.push(seen);
      const key = `${request.method} ${url.pathname}`;
      let status = 404;
      let headers = { "Content-Type": "application/json" };
      let text = JSON.stringify({ error: { message: `no route ${key}, sent ${request.headers.authorization}`, status: "NOT_FOUND" } });
      if (key === "POST /token") [status, headers, text] = tokenAnswer(fake, new URLSearchParams(body.toString("utf8")));
      else if (fake.answers[key]) {
        const [code, answer, type] = fake.answers[key](seen);
        status = code;
        headers = { "Content-Type": type ?? "application/json" };
        text = typeof answer === "string" || Buffer.isBuffer(answer) ? answer : JSON.stringify(answer);
      }
      response.writeHead(status, headers);
      response.end(text);
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  fake.origin = `http://127.0.0.1:${server.address().port}`;
  fake.close = () => server.close();
  fake.sent = (method, path) => fake.requests.filter((one) => one.method === method && one.path === path);
  fake.reset = () => {
    fake.requests.length = 0;
    fake.jwts.length = 0;
    fake.answers = {};
  };
  return fake;
};

/** A fixture home whose configuration sends every Google origin to the fake, and a room to work in. */
export const googleHome = (fake, google = {}) => {
  const home = tempRoom("google-home-");
  mkdirSync(join(home, "forge"));
  writeFileSync(join(home, "forge", "config.json"), JSON.stringify({ google: { endpoint: fake.origin, ...google } }));
  return home;
};

export const keyFile = (fake, room, email = "robot@project.iam.gserviceaccount.com") => {
  const at = join(room, "key.json");
  writeFileSync(at, JSON.stringify({ type: "service_account", project_id: "project", private_key_id: KEY_ID,
    private_key: PRIVATE_KEY, client_email: email, client_id: "112233445566778899", token_uri: `${fake.origin}/token` }));
  return at;
};

export const CLIENT_ID = "fake-client.apps.googleusercontent.com";

/** An OAuth client file with the client under each of `types` — Google writes `installed` for a
 *  Desktop app and `web` for a Web application — or `{ file }` written as it stands. */
export const clientFile = (fake, room, { types = ["installed"], file = null, name = "client_secret.json" } = {}) => {
  const at = join(room, name);
  const client = { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, auth_uri: `${fake.origin}/auth`, token_uri: `${fake.origin}/token` };
  writeFileSync(at, JSON.stringify(file ?? Object.fromEntries(types.map((type) => [type, client]))));
  return at;
};

/** `forge google …` under the home, with no environment token unless the case hands one over. */
export const googleEnv = (home, env = {}) => {
  const held = { ...process.env, XDG_CONFIG_HOME: home, NO_COLOR: "1", ...env };
  if (!env.FORGE_GOOGLE_ACCESS_TOKEN) delete held.FORGE_GOOGLE_ACCESS_TOKEN;
  return held;
};

export const FORGE_BIN = FORGE;

export const google = (home, argv, { env = {}, cwd = home } = {}) => ranAsync(FORGE, ["google", ...argv], googleEnv(home, env), cwd);

/** Every file under a home, relative to it, so a case can say nothing else was written. */
export const filesUnder = (home, at = home) => readdirSync(at).flatMap((name) => {
  const full = join(at, name);
  return statSync(full).isDirectory() ? filesUnder(home, full) : [relative(home, full)];
});

export const SENTINELS = [ACCESS, REFRESH, CLIENT_SECRET, ENV_ACCESS, KEY_ID, KEY_LINE];
