# Third-party Claude skills in this repo

These project skills were copied from public repos on 2026-10-02. They load automatically in any Claude Code session opened in this repo. Nothing here is part of the Haven or ReplyDesk apps, and nothing here is deployed.

| Pack | Source | Commit | License | What was copied |
|---|---|---|---|---|
| Ponytail | https://github.com/DietrichGebert/ponytail | `6c97ffa` | MIT | `skills/` (6 skills: `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`) |
| Security Audit | https://github.com/cloudflare/security-audit-skill | `c1c8a8c` | MIT | `skills/security-audit/` |
| Agent Skills (Addy Osmani) | https://github.com/addyosmani/agent-skills | `9d0c60d` | MIT | `skills/` (25 skills) and `references/` (7 checklists, at `.claude/references/`) |
| Impeccable | https://github.com/pbakaus/impeccable | `508d7e8` | Apache-2.0 | `.claude/skills/impeccable/` and `.claude/agents/impeccable-*.md` |

License texts are in `.claude/licenses/`.

## Left out on purpose

- **Hooks.** No pack's lifecycle hooks are installed, so nothing runs automatically on session start or on file edits. Ponytail's always-on mode and Impeccable's design detector hook come from their own installers (`/plugin install ponytail@ponytail`, `npx impeccable install`).
- **Agent Skills slash commands and personas** (`/spec`, `/plan`, `/build`, `/test`, `/review`, `/ship` and the four reviewer agents). Several of those names collide with built-in Claude Code commands. The skills still trigger on their own from their descriptions.

## Things to know

- The Impeccable skill calls `.claude/skills/impeccable/scripts/impeccable`, which downloads its engine binary into `~/.impeccable/bin/` the first time it runs.
- `.claude/.gitignore` re-includes `data/` so the repo-level `data/` ignore rule does not drop Impeccable's font index.

## Updating or removing

To update a pack, copy the same folders again from a newer commit. To remove one, delete its folders under `.claude/skills/` (and `.claude/references/` for Agent Skills, `.claude/agents/impeccable-*.md` for Impeccable).
