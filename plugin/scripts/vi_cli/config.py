"""Where the gateway URL, API key, model and project glossary come from."""

import json
import os
import sys

from .util import CliError, read_json

CONFIG_DIR = os.path.join(
    os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config"), "vi-natural"
)
CONFIG_PATH = os.path.join(CONFIG_DIR, "config.json")
GLOSSARY_FILE = ".vi-glossary.json"

DEFAULT_BASE_URL = "https://serp-api.musetools.com/v1"
DEFAULT_MODEL = "cx/gpt-5.6-luna"


EFFORTS = ("minimal", "low", "medium", "high")
# `review` is a judgement call — whether a sentence is ambiguous is exactly
# the question reasoning is for, and the eval picked this model on that verb.
# The producing verbs are not: they follow a written contract, and reasoning
# talks itself out of it. At `--effort high` luna dropped the `quý khách` of
# `trang-trong` in 4 of 9 samples of one string; at `low`, 3 of 3 kept it.
# So the default is per verb, and `--effort` still overrides either way.
EFFORT_BY_VERB = {"review": "high"}
DEFAULT_EFFORT = "low"


def find_up(filename, start=None):
    current = os.path.abspath(start or os.getcwd())
    while True:
        candidate = os.path.join(current, filename)
        if os.path.isfile(candidate):
            return candidate
        parent = os.path.dirname(current)
        if parent == current:
            return None
        current = parent


class Config:
    def __init__(self, opts=None):
        self.opts = opts or {}
        self.file = read_json(CONFIG_PATH, {}) or {}
        self.glossary_meta = {}
        self._said_glossary = False

    def _pick(self, key, env_names, default=None):
        if self.opts.get(key):
            return self.opts[key]
        for name in env_names:
            if os.environ.get(name):
                return os.environ[name]
        if self.file.get(key):
            return self.file[key]
        return default

    @property
    def base_url(self):
        raw = self._pick("base_url", ("VI_NATURAL_BASE_URL", "MUSETOOLS_BASE_URL"), DEFAULT_BASE_URL)
        return raw.rstrip("/")

    @property
    def api_key(self):
        key = self._pick("api_key", ("VI_NATURAL_API_KEY", "MUSETOOLS_API_KEY"))
        if not key:
            raise CliError(
                "no API key configured.\n"
                "  run: vi-natural login --key <key>\n"
                "  or set MUSETOOLS_API_KEY in the environment"
            )
        return key

    @property
    def model(self):
        return self._pick("model", ("VI_NATURAL_MODEL",), DEFAULT_MODEL)

    @property
    def effort(self):
        default = EFFORT_BY_VERB.get(self.opts.get("verb"), DEFAULT_EFFORT)
        value = self._pick("effort", ("VI_NATURAL_EFFORT",), default)
        if value not in EFFORTS:
            raise CliError("effort must be one of %s, not %r"
                           % (", ".join(EFFORTS), value))
        return value

    def glossary(self):
        """Project terms that outrank the built-in style rules.

        `.vi-glossary.json` maps an English term to its required Vietnamese
        rendering, or to null to mean "leave this in English".
        """
        if self.opts.get("no_glossary"):
            return {}
        path = self.opts.get("glossary") or find_up(GLOSSARY_FILE)
        # Absence is the silent failure this tool has: without a glossary every term still
        # translates, just not to the project's word for it, and the output looks correct to
        # anyone who does not already know the vocabulary. A glossary committed on another
        # branch is exactly this case. So say which of the two happened, once, on stderr.
        if not self._said_glossary:
            self._said_glossary = True
            if path:
                sys.stderr.write("glossary: %s\n" % path)
            else:
                sys.stderr.write(
                    "glossary: none found above %s — project terms will not be pinned\n"
                    % os.getcwd()
                )
        if not path:
            return {}
        data = read_json(path, {}) or {}
        if not isinstance(data, dict):
            raise CliError("%s must be a JSON object of term -> translation" % path)
        self.glossary_path = path
        # Underscore keys carry project settings (_register, _region), not terms.
        self.glossary_meta = {k: v for k, v in data.items() if k.startswith("_")}
        return {k: v for k, v in data.items() if not k.startswith("_")}

    def ignore_patterns(self, meta=None):
        """Key globs whose placeholder check is a known false alarm.

        A string that talks *about* syntax — "A { is never closed by a }" — parses
        as an interpolation named `is`. Rather than weaken detection for every
        catalog, let a project name the handful of keys that are prose about braces.
        """
        raw = self.opts.get("ignore")
        if isinstance(raw, str):
            raw = [part.strip() for part in raw.split(",") if part.strip()]
        if not raw:
            raw = (meta or getattr(self, "glossary_meta", {})).get("_ignore")
        if not raw:
            raw = self.file.get("ignore")
        if isinstance(raw, str):
            raw = [raw]
        return list(raw or [])

    def register(self, meta=None):
        """Which voice to write in. Flag beats project file beats user config."""
        return (self.opts.get("register")
                or os.environ.get("VI_NATURAL_REGISTER")
                or (meta or getattr(self, "glossary_meta", {})).get("_register")
                or self.file.get("register")
                or "san-pham")

    def region(self, meta=None):
        return (self.opts.get("region")
                or os.environ.get("VI_NATURAL_REGION")
                or (meta or getattr(self, "glossary_meta", {})).get("_region")
                or self.file.get("region"))


def save(values):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    current = read_json(CONFIG_PATH, {}) or {}
    current.update({k: v for k, v in values.items() if v is not None})
    tmp = CONFIG_PATH + ".tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(current, handle, indent=2)
        handle.write("\n")
    os.replace(tmp, CONFIG_PATH)
    os.chmod(CONFIG_PATH, 0o600)
    return CONFIG_PATH
