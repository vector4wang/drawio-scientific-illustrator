# Changelog

## 1.2.0 — 2026-08-02

### Changed
- **drawio-live SKILL.md rewritten** (both `claude-code/skills/` and `plugins/.../skills/`): from a tool-tutorial shape to a design-system + work-sequence + validation-checklist shape. 12 sections covering hard boundary, design tokens (8 constants), 7-color category mapping, semantic-to-shape priority, AWS/Azure/GCP stencil rules, layout grammar, edge rules, 9-step work sequence, 10 anti-patterns, 8-item validation checklist. Trigger phrases now in frontmatter description.
- Refocused the project on drawing diagrams from a description/requirements via the `drawio-live` skill; removed the `recreate-scientific-figure-in-drawio` skill from both the Codex plugin and Claude Code.
- Both hosts now expose the same draw-from-description workflow: `drawio-live` skill with `agents/openai.yaml` on the Codex side, `/drawio-live` trigger on the Claude Code side.
- Bumped plugin version to 1.2.0 in both `.codex-plugin/plugin.json` and `.claude-plugin/plugin.json`; aligned author and homepage metadata to `vector4wang`.
- Installers (`install.sh`, `install.ps1`) detect both `codex` and `claude` on PATH and run the matching setup; when only Claude Code is present, they print the `/plugin marketplace add` + `/plugin install` slash commands the user has to run inside a session. Standalone `install-claude.sh` / `install-claude.ps1` removed.
- `server.mjs` (drawio-file-utils MCP) trimmed from 9 tools to 5: removed `drawio_create_diagram`, `drawio_create_trace_document`, `drawio_write_xml`, `drawio_open` (all redundant with the live MCP or trivial). 763 lines → 452 lines (-41%).
- `validate-repo.mjs` checks the new 1.2.0 version; `smoke-test.mjs` reports 1.2.0 as its client version.

### Added
- Root `.mcp.json` for Claude Code MCP auto-detection when the repository is opened as a project.
- Claude Code skill template at `claude-code/skills/drawio-live/SKILL.md` for installation to `~/.claude/skills/drawio-live/`.
- Codex skill at `plugins/drawio-scientific-illustrator/skills/drawio-live/SKILL.md` with `agents/openai.yaml`.
- `templates/01-aws-3tier-webapp/` — a production-ready AWS 3-tier reference architecture template (editable `.drawio` plus 2000 px preview PNG). Demonstrates the design system: AWS service stencils with `verticalLabelPosition=bottom`, single-tint category color blocks, dashed VPC/AZ boundaries, no in-card text, 350 ms draw pacing.
- `templates/02-plugin-architecture/` — a self-documentation template that shows the simplified 1.2.0 architecture itself.
- `examples/` — sample outputs from prior sessions, kept as-is for reference.
- `.gitignore` rules to exclude local session state (`.claude/`, `.claude-bridge/`, `.$*.dtmp`).

### Removed
- `recreate-scientific-figure-in-drawio` skill and its `agents/openai.yaml` from both the Codex plugin and the Claude Code skill directory.
- Stray test `.drawio` files and PNG previews from the repository root (relocated to `examples/`).
- `.claude-bridge/` sandbox files.
- `install-claude.sh` and `install-claude.ps1` (functionality merged into the dual-host `install.sh` / `install.ps1`).

## 1.1.0 — 2026-07-28

- Added Claude Code support alongside existing Codex plugin.

## 1.0.0 — 2026-07-12

- First public release.
- Live, visible draw.io canvas control through draw.io's graph API and a localhost-only MCP server.
- Paced shape, connector, update, fit, inspection, screenshot, and post-drawing snapshot tools.
- Saved-file validation and PNG/SVG/PDF/JPG export utilities.
- Automatic draw.io executable discovery for common Windows, macOS, and Linux installations.
- Port collision protection and draw.io-only debugging target selection.
- Bilingual English/Chinese documentation and installer scripts.
- Repository-local Codex marketplace metadata and CI smoke tests.
