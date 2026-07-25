param(
  [string]$InstallDir = "$HOME\.codex\marketplaces\drawio-scientific-illustrator",
  [switch]$Link
)

$ErrorActionPreference = "Stop"
$Repository = "https://github.com/vector4wang/drawio-scientific-illustrator.git"
$Plugin = "drawio-scientific-illustrator@drawio-scientific-tools"
$ClaudeSkillName = "recreate-scientific-figure-in-drawio"
$ClaudeSkillDir = "$HOME\.claude\skills\$ClaudeSkillName"
$ClaudeSkillNameLive = "drawio-live"
$ClaudeSkillDirLive = "$HOME\.claude\skills\$ClaudeSkillNameLive"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is required. Install Git for Windows, then run this installer again."
}

$HasCodex = $null -ne (Get-Command codex -ErrorAction SilentlyContinue)
$HasClaude = $null -ne (Get-Command claude -ErrorAction SilentlyContinue)

if (-not $HasCodex -and -not $HasClaude) {
  throw "Neither Codex CLI nor Claude Code CLI was found. Install at least one, then run this installer again."
}

# Clone or update the repository (shared)
if (Test-Path (Join-Path $InstallDir ".git")) {
  Write-Host "Updating existing installation at $InstallDir ..."
  git -C $InstallDir pull --ff-only
} elseif (Test-Path $InstallDir) {
  throw "Install directory exists but is not this Git repository: $InstallDir"
} else {
  Write-Host "Cloning to $InstallDir ..."
  New-Item -ItemType Directory -Force -Path (Split-Path $InstallDir -Parent) | Out-Null
  git clone $Repository $InstallDir
}

$Installed = @()

# Codex setup
if ($HasCodex) {
  codex plugin marketplace add $InstallDir
  codex plugin add $Plugin
  $Installed += "Codex: $Plugin"
}

# Claude Code setup
if ($HasClaude) {
  # Install recreate-scientific-figure-in-drawio skill
  New-Item -ItemType Directory -Force -Path $ClaudeSkillDir | Out-Null
  $SkillSource = Join-Path $InstallDir "claude-code\skills\$ClaudeSkillName\SKILL.md"
  $SkillTarget = Join-Path $ClaudeSkillDir "SKILL.md"

  if ($Link) {
    if (Test-Path $SkillTarget) { Remove-Item $SkillTarget -Force }
    New-Item -ItemType SymbolicLink -Path $SkillTarget -Target $SkillSource | Out-Null
    $Installed += "Claude Code: skill symlink -> $SkillSource"
  } else {
    Copy-Item $SkillSource $SkillTarget -Force
    $Installed += "Claude Code: skill installed to $ClaudeSkillDir"
  }

  # Install drawio-live skill
  New-Item -ItemType Directory -Force -Path $ClaudeSkillDirLive | Out-Null
  $SkillSourceLive = Join-Path $InstallDir "claude-code\skills\$ClaudeSkillNameLive\SKILL.md"
  $SkillTargetLive = Join-Path $ClaudeSkillDirLive "SKILL.md"

  if ($Link) {
    if (Test-Path $SkillTargetLive) { Remove-Item $SkillTargetLive -Force }
    New-Item -ItemType SymbolicLink -Path $SkillTargetLive -Target $SkillSourceLive | Out-Null
    $Installed += "Claude Code: drawio-live skill symlink -> $SkillSourceLive"
  } else {
    Copy-Item $SkillSourceLive $SkillTargetLive -Force
    $Installed += "Claude Code: drawio-live skill installed to $ClaudeSkillDirLive"
  }

  $Installed += "Claude Code: .mcp.json available at $InstallDir\.mcp.json"
}

Write-Host "`n========================================"
Write-Host " Installation complete!"
Write-Host "========================================`n"
foreach ($item in $Installed) {
  Write-Host "  + $item"
}
Write-Host ""
if ($HasCodex) {
  Write-Host "  -> Restart Codex and start a new task before first use."
}
if ($HasClaude) {
  Write-Host "  -> Claude Code: open '$InstallDir' as your project directory."
  Write-Host "     The .mcp.json at the project root will be auto-detected."
  if (-not $Link) {
    Write-Host "     Tip: re-run with -Link to auto-update the skill on git pull."
  }
}
Write-Host ""
