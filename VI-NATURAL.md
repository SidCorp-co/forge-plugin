# vi-natural

Vietnamese for software, written the way a Vietnamese product writes it.

An LLM asked in passing to "translate this to Vietnamese" returns Vietnamese that
parses, ships, and reads like a machine: `sự thay đổi của bạn đã được lưu lại một
cách thành công`. Nobody on the team notices, because nobody on the team reads
Vietnamese. This plugin exists to stop that.

Two things make it more than a `curl` wrapper:

1. **A written style contract** (`scripts/vi_cli/prompts.py`) — xưng hô rules, bare
   imperative UI verbs, the specific calques to delete, which technical terms stay
   in English. It is versioned with the code, so a bad translation is a diff you can
   argue with, not a prompt someone improvised.
2. **A voice you choose.** `--register san-pham | trang-trong | than-mat` — product,
   formal commerce, or warm marketing. Vietnamese encodes the relationship in the
   pronouns; `bạn` and `quý khách` are not interchangeable, and picking wrong is the
   most visible localization error there is.
3. **CTA discipline.** A button says the verb; the screen says the noun. `Save` must
   come back as `Lưu`, not `Lưu khách hàng` — one label that works on every form
   instead of one key per entity. Enforced when translating, audited by `--check`.
4. **A verification gate.** Every translated string is compared against its source
   for placeholders — `{{name}}`, `{name}`, `%s`, `%1$s`, `%(name)s`, `:name`,
   ICU plurals, HTML tags. A string that loses or renames one is retried once, then
   left in English and reported. It never reaches the file.

Stdlib-only Python 3. No dependencies.

## Install

```bash
claude plugin marketplace add ~/.claude/vi-plugin
claude plugin install vi-natural@vi-natural-local
vi-natural login --key <gateway-key>
vi-natural doctor
```

The key is stored in `~/.config/vi-natural/config.json` at mode 600, or read from
`MUSETOOLS_API_KEY`. It is never written into the plugin.

## Use

```bash
vi-natural i18n locales/en.json          # → locales/vi.json, missing keys only
vi-natural i18n locales/en.json --check  # offline: missing keys, damaged placeholders
vi-natural doc README.md                 # → README.vi.md, code and links untouched
vi-natural translate "Delete this item permanently?"
vi-natural review locales/vi.json --fix  # rewrite translationese in place
vi-natural i18n locales/en.json --register trang-trong   # quý khách voice
```

`--check` costs nothing and needs no network. It belongs in CI. Keys whose text is
*about* brace syntax trip the placeholder gate; exempt them with
`--ignore 'codePatterns.*'` or `"_ignore"` in the glossary.

## Terminology

`.vi-glossary.json`, found by walking up from the working directory:

```json
{ "_register": "trang-trong", "workspace": null, "repository": "kho mã" }
```

`null` keeps the English word. Glossary entries outrank the built-in style rules,
and `_register` / `_region` pin the project's voice so the flag is not needed.

Locale strings are sent with their key path as context (`common.buttons.save` →
this is a Lưu button, not "tiết kiệm"), which is what a human translator would ask
for first.

## Defaults

| setting  | default                             | override                                 |
| -------- | ----------------------------------- | ---------------------------------------- |
| gateway  | `https://serp-api.musetools.com/v1` | `--base-url`, `VI_NATURAL_BASE_URL`      |
| model    | `cx/gpt-5.6-luna`                   | `--model`, `VI_NATURAL_MODEL`            |
| effort   | `low`, `high` for `review`          | `--effort`, `VI_NATURAL_EFFORT`          |
| key      | config file                         | `MUSETOOLS_API_KEY`                      |
| register | `san-pham`                          | `--register`, `_register`, `VI_NATURAL_REGISTER` |

Any OpenAI-compatible chat endpoint works; `vi-natural models` lists what the
gateway offers.

## Exit codes

- `0` — clean
- `1` — error, or `review` found something
- `2` — file written, but some strings were refused and left in English

## Layout

```
scripts/vi_cli/prompts.py       the style contract — the actual product
scripts/vi_cli/placeholders.py  extraction and comparison of interpolations
scripts/vi_cli/cta.py           bare-CTA lexicon, inflation and collapse audits
scripts/vi_cli/engine.py        batching, verification, per-string retry
scripts/vi_cli/locale.py        nested JSON walking and merge-back
scripts/vi_cli/doc.py           Markdown segmentation (byte-exact reassembly)
scripts/vi_cli/cli.py           commands
```
