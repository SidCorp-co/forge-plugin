# vi-natural

Vietnamese for software, written the way a Vietnamese product writes it.

An LLM asked in passing to "translate this to Vietnamese" returns Vietnamese that
parses, ships, and reads like a machine: `sự thay đổi của bạn đã được lưu lại một
cách thành công`. Nobody on the team notices, because nobody on the team reads
Vietnamese. This plugin exists to stop that.

Two things make it more than a `curl` wrapper:

1. **A written style contract** (`vi-natural/vi-text.mjs`) — xưng hô rules, bare
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

Node with no dependencies beyond its own `fetch`.

## Why the client streams, and what `timeout` means

Every completion is streamed. Not for the typing effect — nothing renders a token as it
arrives — but because the gateway sits behind Cloudflare, and Cloudflare closes a
connection whose origin has said nothing for ~100 seconds. A non-streamed batch of 120
strings at `--effort high` takes longer than that to think, so it came back 524 every
time, at 125 seconds, having burned the tokens. Streamed, the same batch answers in 184
seconds with never more than 14 seconds between chunks.

That changes what `timeout` means: it is an **idle** timeout — the longest silence
tolerated between chunks — not a budget for the whole call. A slow answer no longer looks
like a dead one. `520`, `522` and `524` are Cloudflare's own and are retried; they appear
in no OpenAI error table, which is why a 524 once aborted a run instead of retrying.

## Why `--effort` defaults per verb

`review` is a judgement call — whether a sentence is ambiguous is exactly the question
reasoning is for. The producing verbs are not: they follow a written contract, and
reasoning talks itself out of it. At `--effort high` the default model dropped the
`quý khách` of `trang-trong` in 4 of 9 samples of one string; at `low`, 3 of 3 kept it.
So `review` runs high, everything else low, and `--effort` overrides either way.

## Why a bare CTA matters

`Lưu` works on every form in the product. `Lưu khách hàng` works on one, needs its own
key, and drifts from `Lưu cơ hội` the moment someone edits one of them. `inflated` finds
a label that grew an object its English source never had; `collapse` reports the group of
per-screen keys one shared generic key would already cover. Neither fails a run — a
verbose button is a style call, not a bug.

## How the port is held to the original

The CLI was Python first. Two checks keep the rewrite honest:

- `tools/check-vi-text.mjs` — no file outside `vi-natural/vi-text.mjs` may hold a
  Vietnamese string literal, so the prose cannot be quietly reworded in passing.
- `tools/diff-python.mjs --goldens` — the pure functions (placeholder accounting, CTA
  judgement, Markdown segmentation, locale walking) still answer exactly what the Python
  answered on a fixed corpus.

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
| gateway  | none — required                     | `--base-url`, `VI_NATURAL_BASE_URL`      |
| model    | none — required                     | `--model`, `VI_NATURAL_MODEL`            |
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
vi-natural/vi-text.mjs              the style contract — the actual product
vi-natural/cli.mjs                  argv, usage, dispatch
vi-natural/text/prompts.mjs         assembling the system message
vi-natural/text/placeholders.mjs    extraction and comparison of interpolations
vi-natural/text/cta.mjs             bare-CTA lexicon, inflation and collapse audits
vi-natural/format/json-order.mjs    JSON that keeps its key order
vi-natural/format/locale.mjs        nested tree walking and merge-back
vi-natural/format/doc.mjs           Markdown segmentation (byte-exact reassembly)
vi-natural/gateway/config.mjs       key, model, effort, glossary — and where each resolved from
vi-natural/gateway/client.mjs       the streaming client
vi-natural/gateway/engine.mjs       batching, verification, per-string retry
vi-natural/commands/                one file per verb
```

`json-order.mjs` exists for one reason: `JSON.parse` reorders integer-like keys ahead of
the rest, before any reviver can see them, so a catalog with a `"404"` key would come back
in a different order than it was written. This CLI promises the target comes out in the
source's key order, so objects are read into `Map`s instead.
