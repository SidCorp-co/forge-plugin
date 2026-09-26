/* The owner's seven documented overrides, taken whole from the transcripts the issue cites (ISS-2572):
   the questions where the owner's answer was the input and a recommendation, had there been one to
   take, would have been wrong. A fixed set: no gate may ever decide one, whatever it declares. */
export const OWNER_OVERRIDES = [
  {
    "at": "2026-09-17",
    "project": "forge",
    "question": "ISS-1030 already owns the streaming work and picks WebSocket over SSE, for a reason I missed. Which transport stands?",
    "header": "Transport",
    "options": [
      {
        "label": "WebSocket — follow ISS-1030",
        "description": "The recorded decision wins: `conversation.message`/`conversation.settled` stop being doorbells and carry the canonical AgentMessage; the client reduces frames by entry id instead of refetching. Everyone in the room sees the turn stream, not just the sender. An `accepted` frame on the same socket fixes the \"Sending…\" defect."
      },
      {
        "label": "SSE — override ISS-1030",
        "description": "Keep the choice we made: ordered accepted/progress/settled frames on the send route. Simpler client, one ordered stream, no fan-out. Costs the multi-participant case — a second person in the room gets only the settled refetch — and overrides a recorded decision, which I'd note on ISS-1030 as a correction."
      },
      {
        "label": "Both, split by job",
        "description": "SSE carries `accepted` to the sender (fixes \"Sending…\" with no fan-out and no token), WebSocket carries `progress` to every participant. Honest about what each transport is good at, but it is two wires for one turn and two things to keep in step."
      }
    ],
    "owner": "WebSocket — follow ISS-1030"
  },
  {
    "at": "2026-08-31",
    "project": "forge-plugin",
    "question": "How should the cloudflare CLI be shaped inside this plugin?",
    "header": "CLI shape",
    "options": [
      {
        "label": "Separate `cloudflare` bin (Recommended)",
        "description": "plugin/bin/cloudflare + plugin/cloudflare/ + plugin/skills/cloudflare/SKILL.md, following the bundled vi-natural precedent. Its own endpoint/key resolution, so pointing at the legacy server doesn't disturb the forge CLI's beta config. Doctor grows lines for it."
      },
      {
        "label": "`forge cloudflare` subcommand",
        "description": "One more verb on the existing forge CLI. Fewer moving parts, but the verb has to override the endpoint and the auth header per-call, since cloudflare only exists on the legacy server while every other verb lives on beta — a wart in the credential resolver."
      }
    ],
    "owner": "`forge cloudflare` subcommand"
  },
  {
    "at": "2026-09-17",
    "project": "forge",
    "question": "How should the content be split into issues?",
    "header": "Granularity",
    "options": [
      {
        "label": "One per unit of work — ~9 (Recommended)",
        "description": "Collector defect · room presence override · reply/quote column · answerInGroup:'tool' · the room's ack+status · clarification routing · transcript index · quote neighbours · second adapter. Each has a deliverable someone else can verify."
      },
      {
        "label": "Three grouped issues",
        "description": "Collector (defect + cut reason + overflow) · Routing & context (presence, mention, tool, quotes, index) · The room (ack, status, clarification). Fewer rows, but the middle one is not one unit of work."
      },
      {
        "label": "One issue for everything",
        "description": "A single row carrying all of it. Easiest to read, but it has no single deliverable and nobody can verify it complete — it would fail the tracker's own admission gate."
      }
    ],
    "owner": "Three grouped issues"
  },
  {
    "at": "2026-09-21",
    "project": "forge-plugin",
    "question": "The checkout's `.forge.json` is now read by nothing at runtime. What should happen to it?",
    "header": "Committed file",
    "options": [
      {
        "label": "Keep it as the adoption seed (Recommended)",
        "description": "It stays tracked, read only by `forge doctor --adopt`. It is the only route that configures a fresh clone or a second machine without hand-setting ten keys — and since no code reads it at runtime, it is not a precedence layer, so G-12 and one-source-per-decision are not in play. Cost: it goes stale the first time you `forge doctor --set` here, and a human reading the repo could believe it."
      },
      {
        "label": "Delete it from the repo",
        "description": "The machine record becomes the only home for this project's config, so there is no stale copy anybody can misread. Cost: a fresh clone or a new machine has nothing to adopt from, so every key is set by hand; I would also update README.md:89 and the docs that describe the adopt route, and check the three declared-path lists in tools/gates/steps.mjs that name it."
      },
      {
        "label": "Delete it, and add a seed command instead",
        "description": "Remove the tracked file, but give the repo a committed way to reproduce the config on a new machine that cannot silently go stale — a documented sequence or a small script under tools/. More work than the other two, and it is a new shape that would want its own issue rather than a hand edit."
      }
    ],
    "owner": "Delete it from the repo"
  },
  {
    "at": "2026-08-31",
    "project": "forge-plugin",
    "question": "These zones are live production domains. How should the four write actions be handled?",
    "header": "Write actions",
    "options": [
      {
        "label": "Ship all 8, writes need --yes (Recommended)",
        "description": "dns_create, dns_update, dns_delete and purge_cache are implemented but refuse to run without an explicit --yes flag, printing the exact record they would change first. Reads work unflagged."
      },
      {
        "label": "Ship all 8, no confirmation",
        "description": "Every action callable directly, matching the server tool's own behaviour exactly. Fastest to use, no guard against a mistaken delete on a real zone."
      },
      {
        "label": "Read-only first",
        "description": "Only search, list_zones, zone_details and dns_list. The four write actions come in a follow-up once the read half has been used against real zones."
      }
    ],
    "owner": "Ship all 8, no confirmation"
  },
  {
    "at": "2026-09-03",
    "project": "forge",
    "question": "I need the LiteLLM key to make real calls. How do you want to supply it?",
    "header": "Live creds",
    "options": [
      {
        "label": "You export it, I read the env",
        "description": "You run `! export LITELLM_API_KEY=sk-...` (or write it to /tmp/cf/key) in this session, and I pick it up from there. Keeps it out of the transcript as a value I echo, though the shell line itself will appear."
      },
      {
        "label": "Paste it to me",
        "description": "You paste the key in a message. Simplest, but it lands in the conversation transcript permanently."
      },
      {
        "label": "Skip live calls",
        "description": "I run only what needs no credentials: the config audit, and a local reproduction against a testcontainer Postgres proving the silent-degradation path prod is currently in. No token spend, no live proof that the proxy works."
      }
    ],
    "owner": "cli have reveal flag"
  },
  {
    "at": "2026-09-17",
    "project": "forge",
    "question": "The pull needs your package.json / pnpm-lock.yaml modifications out of the way. How do you want that done?",
    "header": "Conflict",
    "options": [
      {
        "label": "Discard those two, keep the patch",
        "description": "I run `git checkout -- package.json pnpm-lock.yaml`, then pull. Your eslint.config.mjs and code-quality.json stay untouched on disk, and the patch at /tmp/forge-iss/ re-applies the package.json half whenever you want it. pnpm-lock.yaml regenerates from `pnpm install` anyway, so nothing is truly lost."
      },
      {
        "label": "You clear it, I wait",
        "description": "You handle it yourself — commit it to a branch, stash it, whatever you intended — and tell me when the tree is clean. I don't touch your work at all."
      },
      {
        "label": "Worktree after all",
        "description": "Leave this checkout exactly as it is, dirty and behind, and I work from a fresh worktree at origin/main instead. Costs the 0.8–3 GB `pnpm install` you were avoiding, but touches nothing of yours."
      }
    ],
    "owner": "Discard those two, keep the patch"
  }
];
