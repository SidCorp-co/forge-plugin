/* Where the instance, its token and this checkout's project pin come from: the credential from
   this CLI's own configuration, the pin from the checkout's `.coolify.json`. docs/cli/coolify.md. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { configPath, userConfig } from "../../../resolve/config.mjs";

export const SCOPE_FILE = ".coolify.json";

export const NO_TARGET =
  "No Coolify instance is configured. Save one with\n"
  + "  forge coolify login --url https://coolify.example.com --token <api-token>";

/* A pin a flag or an environment variable could retarget follows you into every directory, which
   is the ambient scope the guard exists to prevent. The format is the Python CLI's, read as it is. */
const pinFile = (from = process.cwd()) => {
  let here = resolve(from);
  for (;;) {
    const candidate = join(here, SCOPE_FILE);
    if (existsSync(candidate)) return candidate;
    const up = dirname(here);
    if (up === here) return null;
    here = up;
  }
};

const readPin = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
};

/* One value or several, spelled either way round, so two projects pin as cheaply as one. */
const asList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(asList);
  return String(value).split(",").map((one) => one.trim()).filter(Boolean);
};

const SCOPE_KEYS = ["project_uuid", "environment", "server_uuid"];

export const pinned = (from = process.cwd()) => {
  const at = pinFile(from);
  if (!at) return { at: null, spec: {} };
  const held = readPin(at);
  const spec = {};
  for (const key of SCOPE_KEYS) {
    const values = asList(held[key] ?? held[`${key}s`]);
    if (values.length) spec[key] = values;
  }
  return { at, spec };
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

