import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const marketplacePath = path.join(root, ".agents", "plugins", "marketplace.json");
const marketplace = JSON.parse(await fs.readFile(marketplacePath, "utf8"));

if (marketplace.name !== "drawio-scientific-tools") throw new Error("Unexpected marketplace name.");
if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length !== 1) throw new Error("Marketplace must expose exactly one plugin.");

const entry = marketplace.plugins[0];
const pluginRoot = path.resolve(path.dirname(marketplacePath), "..", "..", entry.source.path);
const manifest = JSON.parse(await fs.readFile(path.join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
const mcp = JSON.parse(await fs.readFile(path.join(pluginRoot, ".mcp.json"), "utf8"));

if (entry.name !== manifest.name) throw new Error("Marketplace and manifest plugin names differ.");
if (manifest.version !== "1.0.0") throw new Error("Unexpected public release version.");
if (!mcp.mcpServers?.["drawio-live"] || !mcp.mcpServers?.["drawio-file-utils"]) throw new Error("Required MCP servers are missing.");

// ── Claude Code config ──
const claudeMcpPath = path.join(root, ".mcp.json");
const claudeSkillFile = path.join(root, "claude-code", "skills", "recreate-scientific-figure-in-drawio", "SKILL.md");

const claudeMcp = JSON.parse(await fs.readFile(claudeMcpPath, "utf8"));
if (!claudeMcp.mcpServers?.["drawio-live"] || !claudeMcp.mcpServers?.["drawio-file-utils"]) {
  throw new Error("Root .mcp.json is missing required MCP servers (drawio-live, drawio-file-utils).");
}
for (const [name, server] of Object.entries(claudeMcp.mcpServers)) {
  const scriptPath = path.join(root, server.cwd || ".", server.args?.[0] || "");
  try { await fs.access(scriptPath); } catch {
    throw new Error(`Root .mcp.json server "${name}" references missing script: ${server.args?.[0]}`);
  }
}

const skillContent = await fs.readFile(claudeSkillFile, "utf8");
if (!skillContent.startsWith("---\n")) throw new Error("Claude Code SKILL.md must have YAML frontmatter.");
if (!/^name:\s+/m.test(skillContent) || !/^description:\s+/m.test(skillContent)) {
  throw new Error("Claude Code SKILL.md frontmatter must include name and description.");
}

const files = [
  marketplacePath,
  path.join(pluginRoot, ".codex-plugin", "plugin.json"),
  path.join(pluginRoot, ".mcp.json"),
  path.join(pluginRoot, "scripts", "shared.mjs"),
  path.join(pluginRoot, "scripts", "live-server.mjs"),
  path.join(pluginRoot, "scripts", "server.mjs"),
  claudeMcpPath,
  claudeSkillFile,
];

for (const file of files) {
  const text = await fs.readFile(file, "utf8");
  if (/C:\\Users\\[^\\]+|C:\/Users\/[^/]+|ProgramData\\miniconda3|gho_|github_pat_/i.test(text)) {
    throw new Error(`Local path or credential-like value found in ${path.relative(root, file)}.`);
  }
}

console.log("Repository structure and portability checks passed.");
