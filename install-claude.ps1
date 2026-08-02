param(
  [string]$InstallDir = "$HOME\.claude\marketplaces\drawio-scientific-illustrator"
)

$ErrorActionPreference = "Stop"
$Repository = "https://github.com/vector4wang/drawio-scientific-illustrator.git"
$Marketplace = "drawio-scientific-tools"
$Plugin = "drawio-scientific-illustrator@$Marketplace"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is required. Install Git for Windows, then run this installer again."
}

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Warning "Claude Code CLI ('claude') was not found on PATH. The repository will still be prepared, but you will need to install Claude Code before the final /plugin commands can run."
}

if (Test-Path (Join-Path $InstallDir ".git")) {
  git -C $InstallDir pull --ff-only
} elseif (Test-Path $InstallDir) {
  throw "Install directory exists but is not this Git repository: $InstallDir"
} else {
  New-Item -ItemType Directory -Force -Path (Split-Path $InstallDir -Parent) | Out-Null
  git clone $Repository $InstallDir
}

$AbsoluteDir = (Resolve-Path $InstallDir).Path

Write-Host ""
Write-Host "Repository ready at: $AbsoluteDir"
Write-Host ""
Write-Host "Finish installation inside Claude Code by pasting these two slash commands:"
Write-Host ""
Write-Host "    /plugin marketplace add $AbsoluteDir"
Write-Host "    /plugin install $Plugin"
Write-Host ""
Write-Host "After installation, restart Claude Code (or start a new session) so the new skill and MCP tools are loaded."
