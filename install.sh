#!/usr/bin/env bash
set -euo pipefail

REPOSITORY="https://github.com/vector4wang/drawio-scientific-illustrator.git"
INSTALL_DIR="${1:-$HOME/.codex/marketplaces/drawio-scientific-illustrator}"
PLUGIN="drawio-scientific-illustrator@drawio-scientific-tools"
CLAUDE_SKILL_NAME_LIVE="drawio-live"
CLAUDE_SKILL_DIR_LIVE="$HOME/.claude/skills/$CLAUDE_SKILL_NAME_LIVE"
LINK_MODE=false

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --link) LINK_MODE=true ;;
    --help|-h)
      echo "Usage: $0 [INSTALL_DIR] [--link]"
      echo ""
      echo "  INSTALL_DIR  Where to clone the repo (default: ~/.codex/marketplaces/drawio-scientific-illustrator)"
      echo "  --link       Use symlink for Claude Code skill (auto-updates when repo is pulled)"
      echo ""
      exit 0
      ;;
  esac
done

command -v git >/dev/null || { echo "Git is required." >&2; exit 1; }

HAS_CODEX=0
HAS_CLAUDE=0
command -v codex >/dev/null 2>&1 && HAS_CODEX=1
command -v claude >/dev/null 2>&1 && HAS_CLAUDE=1

if [[ $HAS_CODEX -eq 0 && $HAS_CLAUDE -eq 0 ]]; then
  echo "Neither Codex CLI nor Claude Code CLI was found." >&2
  echo "Install at least one, then run this installer again." >&2
  exit 1
fi

# ── Clone or update the repository (shared) ──
if [[ -d "$INSTALL_DIR/.git" ]]; then
  echo "Updating existing installation at $INSTALL_DIR ..."
  git -C "$INSTALL_DIR" pull --ff-only
elif [[ -e "$INSTALL_DIR" ]]; then
  echo "Install directory exists but is not this Git repository: $INSTALL_DIR" >&2
  exit 1
else
  echo "Cloning to $INSTALL_DIR ..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPOSITORY" "$INSTALL_DIR"
fi

INSTALLED=()

# ── Codex setup ──
if [[ $HAS_CODEX -eq 1 ]]; then
  codex plugin marketplace add "$INSTALL_DIR"
  codex plugin add "$PLUGIN"
  INSTALLED+=("Codex: $PLUGIN")
fi

# ── Claude Code setup ──
if [[ $HAS_CLAUDE -eq 1 ]]; then
  # Install drawio-live skill
  mkdir -p "$CLAUDE_SKILL_DIR_LIVE"
  SKILL_SRC_LIVE="$INSTALL_DIR/claude-code/skills/$CLAUDE_SKILL_NAME_LIVE/SKILL.md"
  SKILL_DST_LIVE="$CLAUDE_SKILL_DIR_LIVE/SKILL.md"

  if $LINK_MODE; then
    rm -f "$SKILL_DST_LIVE"
    ln -sf "$SKILL_SRC_LIVE" "$SKILL_DST_LIVE"
    INSTALLED+=("Claude Code: drawio-live skill symlink → $SKILL_SRC_LIVE")
  else
    cp "$SKILL_SRC_LIVE" "$SKILL_DST_LIVE"
    INSTALLED+=("Claude Code: drawio-live skill installed to $CLAUDE_SKILL_DIR_LIVE")
  fi

  INSTALLED+=("Claude Code: .mcp.json available at $INSTALL_DIR/.mcp.json")
fi

# ── Summary ──
echo ""
echo "════════════════════════════════════════"
echo " Installation complete!"
echo "════════════════════════════════════════"
echo ""
for item in "${INSTALLED[@]}"; do
  echo "  ✓ $item"
done
echo ""
if [[ $HAS_CODEX -eq 1 ]]; then
  echo "  → Restart Codex and start a new task before first use."
fi
if [[ $HAS_CLAUDE -eq 1 ]]; then
  echo "  → Claude Code: open '$INSTALL_DIR' as your project directory."
  echo "    The .mcp.json at the project root will be auto-detected."
  if ! $LINK_MODE; then
    echo "    Tip: re-run with --link to auto-update the skill on git pull."
  fi
fi
echo ""
