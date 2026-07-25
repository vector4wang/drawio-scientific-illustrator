# Changelog

## Unreleased

- Added Claude Code support alongside existing Codex plugin.
- Root `.mcp.json` for Claude Code MCP auto-detection when the repository is opened as a project.
- Claude Code skill template at `claude-code/skills/` for installation to `~/.claude/skills/`.
- Installers (`install.sh`, `install.ps1`) now detect and configure both Codex and Claude Code; at least one must be present.
- `validate-repo.mjs` now verifies the root `.mcp.json` and Claude Code skill frontmatter.
- README updated with Claude Code installation, usage, and troubleshooting sections (bilingual).

## 1.0.0 — 2026-07-12

- First public release.
- Live, visible draw.io canvas control through draw.io's graph API and a localhost-only MCP server.
- Paced shape, connector, update, fit, inspection, screenshot, and post-drawing snapshot tools.
- Saved-file validation and PNG/SVG/PDF/JPG export utilities.
- Automatic draw.io executable discovery for common Windows, macOS, and Linux installations.
- Port collision protection and draw.io-only debugging target selection.
- Bilingual English/Chinese documentation and installer scripts.
- Repository-local Codex marketplace metadata and CI smoke tests.
