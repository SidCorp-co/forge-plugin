# Setting the gateway up on this machine

Once per machine. SKILL.md says when to come here.

Key and defaults live in `~/.config/vi-natural/config.json` (chmod 600) and
nowhere else — the environment is not read. Precedence: flag →
`.vi-glossary.json` → config file.

```bash
vi-natural login --base-url <url> --key <key> --model <id> --register san-pham
vi-natural models                            # what the gateway offers
vi-natural i18n en.json --model gm/gemini-3.1-pro-preview   # per-run override
```

Gateway, key and model are required and have no default — a host and a model id belong to whoever
runs the gateway, so any OpenAI-compatible endpoint works and the model must name something that
endpoint serves. `vi-natural models` needs no model configured, so it is the way to find one.

`vi-natural doctor` prints each of the three and where it resolved from, then makes one live round
trip. `forge doctor` reports the same three, because the tracker translates before it posts.

## Effort is set per verb, and the default is low on purpose

`review` runs at `--effort high` — judging whether a sentence is ambiguous is what reasoning is
for — and the producing verbs run at `low`, where they follow the style contract instead of arguing
with it. `--effort` overrides either way.
