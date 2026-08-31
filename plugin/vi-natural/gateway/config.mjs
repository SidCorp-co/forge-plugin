// Where the gateway URL, API key, model and project glossary come from.

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { CliError, err, readJson, writeAtomic } from "../util.mjs";

const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "vi-natural");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const GLOSSARY_FILE = ".vi-glossary.json";

export const DEFAULT_MODEL = "cx/gpt-5.6-luna";
export const EFFORTS = ["minimal", "low", "medium", "high"];
export const DEFAULT_EFFORT = "low";

// `review` is a judgement call — whether a sentence is ambiguous is exactly the question reasoning
// is for. The producing verbs are not: they follow a written contract, and reasoning talks itself
// out of it. At `--effort high` luna dropped the `quý khách` of `trang-trong` in 4 of 9 samples of
// one string; at `low`, 3 of 3 kept it.
export const EFFORT_BY_VERB = { review: "high" };

export function findUp(filename, start) {
  let current = resolve(start ?? process.cwd());
  for (;;) {
    const candidate = join(current, filename);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export class Config {
  constructor(opts = {}) {
    this.opts = opts;
    this.file = readJson(CONFIG_PATH, {}) ?? {};
    this.glossaryMeta = {};
    this.glossaryPath = null;
    this.announced = false;
  }

  // The stored file is the one python wrote, so its keys stay snake_case; only this CLI's own
  // option names are camel.
  pick(key, fileKey, envNames, fallback) {
    if (this.opts[key]) return this.opts[key];
    for (const name of envNames) {
      if (process.env[name]) return process.env[name];
    }
    return this.file[fileKey] || fallback;
  }

  // No default host. The gateway is whoever runs one, and a baked-in default publishes the address
  // of a private deployment to everyone who reads this file.
  get baseUrl() {
    const url = this.pick("baseUrl", "base_url", ["VI_NATURAL_BASE_URL", "MUSETOOLS_BASE_URL"]);
    if (!url) {
      throw new CliError(
        "no gateway configured.\n  run: vi-natural login --base-url <url> --key <key>\n" +
          "  or set VI_NATURAL_BASE_URL in the environment\n" +
          "  any OpenAI-compatible endpoint serving /chat/completions works",
      );
    }
    return url.replace(/\/+$/, "");
  }

  get apiKey() {
    const key = this.pick("apiKey", "api_key", ["VI_NATURAL_API_KEY", "MUSETOOLS_API_KEY"]);
    if (!key) {
      throw new CliError(
        "no API key configured.\n  run: vi-natural login --key <key>\n" +
          "  or set MUSETOOLS_API_KEY in the environment",
      );
    }
    return key;
  }

  get model() {
    return this.pick("model", "model", ["VI_NATURAL_MODEL"], DEFAULT_MODEL);
  }

  get effort() {
    const fallback = EFFORT_BY_VERB[this.opts.verb] ?? DEFAULT_EFFORT;
    const value = this.pick("effort", "effort", ["VI_NATURAL_EFFORT"], fallback);
    if (!EFFORTS.includes(value)) {
      throw new CliError(`effort must be one of ${EFFORTS.join(", ")}, not ${JSON.stringify(value)}`);
    }
    return value;
  }

  /** Project terms that outrank the built-in style rules, as a Map so order is the file's. */
  glossary() {
    if (this.opts.noGlossary) return new Map();
    const path = this.opts.glossary || findUp(GLOSSARY_FILE);
    // Absence is the silent failure this tool has: without a glossary every term still translates,
    // just not to the project's word for it, and the output looks correct to anyone who does not
    // already know the vocabulary. A glossary committed on another branch is exactly this case.
    if (!this.announced) {
      this.announced = true;
      err(path ? `glossary: ${path}` : `glossary: none found above ${process.cwd()} — project terms will not be pinned`);
    }
    if (!path) return new Map();
    const data = readJson(path, {}) ?? {};
    if (typeof data !== "object" || Array.isArray(data)) {
      throw new CliError(`${path} must be a JSON object of term -> translation`);
    }
    this.glossaryPath = path;
    // Underscore keys carry project settings (_register, _region), not terms.
    this.glossaryMeta = Object.fromEntries(Object.entries(data).filter(([k]) => k.startsWith("_")));
    return new Map(Object.entries(data).filter(([k]) => !k.startsWith("_")));
  }

  /** Key globs whose placeholder check is a known false alarm.
   *
   *  A string that talks about syntax — "A { is never closed by a }" — parses as an interpolation
   *  named `is`. Rather than weaken detection for every catalog, let a project name the handful of
   *  keys that are prose about braces. */
  ignorePatterns(meta) {
    let raw = this.opts.ignore;
    if (typeof raw === "string") raw = raw.split(",").map((p) => p.trim()).filter(Boolean);
    if (!raw || !raw.length) raw = (meta ?? this.glossaryMeta)._ignore;
    if (!raw || !raw.length) raw = this.file.ignore;
    if (typeof raw === "string") raw = [raw];
    return [...(raw ?? [])];
  }

  register(meta) {
    return (
      this.opts.register ||
      process.env.VI_NATURAL_REGISTER ||
      (meta ?? this.glossaryMeta)._register ||
      this.file.register ||
      "san-pham"
    );
  }

  region(meta) {
    return (
      this.opts.region ||
      process.env.VI_NATURAL_REGION ||
      (meta ?? this.glossaryMeta)._region ||
      this.file.region ||
      null
    );
  }
}

export function save(values) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const current = readJson(CONFIG_PATH, {}) ?? {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined) current[key] = value;
  }
  writeAtomic(CONFIG_PATH, `${JSON.stringify(current, null, 2)}\n`, 0o600);
  return CONFIG_PATH;
}
