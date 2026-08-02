#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${1:-$HOME/.claude/marketplaces/drawio-scientific-illustrator}"
REPOSITORY="https://github.com/vector4wang/drawio-scientific-illustrator.git"
MARKETPLACE="drawio-scientific-tools"
PLUGIN="drawio-scientific-illustrator@${MARKETPLACE}"

command -v git >/dev/null || { echo "Git is required." >&2; exit 1; }
if ! command -v claude >/dev/null; then
  echo "Warning: Claude Code CLI ('claude') was not found on PATH." >&2
  echo "The repository will still be prepared, but install Claude Code before running the final /plugin commands." >&2
fi

if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" pull --ff-only
elif [[ -e "$INSTALL_DIR" ]]; then
  echo "Install directory exists but is not this Git repository: $INSTALL_DIR" >&2
  exit 1
else
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPOSITORY" "$INSTALL_DIR"
fi

ABSOLUTE_DIR="$(cd "$INSTALL_DIR" && pwd)"

cat <<EOF

Repository ready at: ${ABSOLUTE_DIR}

Finish installation inside Claude Code by pasting these two slash commands:

    /plugin marketplace add ${ABSOLUTE_DIR}
    /plugin install ${PLUGIN}

After installation, restart Claude Code (or start a new session) so the new skill and MCP tools are loaded.
EOF
