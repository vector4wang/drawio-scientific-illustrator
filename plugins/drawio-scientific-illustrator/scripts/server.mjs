#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  SERVER_VERSION, xmlEscape, ensureStyle, setStyle,
  createMcpTransport,
} from "./shared.mjs";
import { drawioInstallHint, resolveDrawioExecutable } from "./drawio-path.mjs";

const execFileAsync = promisify(execFile);
const SERVER_NAME = "drawio-scientific-illustrator";
const DRAWIO = resolveDrawioExecutable();
const MAX_XML_BYTES = 12 * 1024 * 1024;

const DEFAULT_EDGE_STYLE =
  "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=1;";

// ── Tool schemas ──

const tools = [
  {
    name: "drawio_status",
    description: "Check the local draw.io desktop CLI, version, default output directory, and supported operations.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "drawio_validate",
    description: "Validate an existing uncompressed .drawio file and report structural errors, warnings, pages, vertices, and edges.",
    inputSchema: {
      type: "object",
      required: ["input_path"],
      properties: { input_path: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_inspect",
    description: "Inspect an existing .drawio file and return a compact inventory of pages, labels, geometry, styles, vertices, and edges for targeted edits.",
    inputSchema: {
      type: "object",
      required: ["input_path"],
      properties: {
        input_path: { type: "string" },
        max_cells: { type: "integer", minimum: 1, maximum: 1000, default: 200 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_update_cells",
    description:
      "Apply targeted edits to existing cells in an uncompressed .drawio file while preserving the rest of the tuned layout. Update labels, styles, and geometry by cell id after using drawio_inspect.",
    inputSchema: {
      type: "object",
      required: ["input_path", "patches"],
      properties: {
        input_path: { type: "string" },
        output_path: { type: "string", description: "Defaults to input_path for in-place edits." },
        patches: {
          type: "array",
          minItems: 1,
          maxItems: 500,
          items: {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              style: { type: "string", description: "Replace the complete style string." },
              style_updates: {
                type: "object",
                description: "Map of draw.io style keys to new values; null removes a key.",
                additionalProperties: { type: ["string", "number", "boolean", "null"] },
              },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number", exclusiveMinimum: 0 },
              height: { type: "number", exclusiveMinimum: 0 },
            },
            additionalProperties: false,
          },
        },
        overwrite: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_export",
    description:
      "Export a .drawio file with the installed draw.io desktop CLI. Preview PNGs should use width=2000 and embed=false; final PNG/SVG/PDF can use embed=true. Embedded PNGs are repaired automatically if draw.io truncates IEND.",
    inputSchema: {
      type: "object",
      required: ["input_path", "format"],
      properties: {
        input_path: { type: "string" },
        format: { type: "string", enum: ["png", "svg", "pdf", "jpg"] },
        output_path: { type: "string" },
        embed: { type: "boolean", default: false },
        scale: { type: "number", minimum: 0.1, maximum: 10 },
        width: { type: "integer", minimum: 100, maximum: 10000 },
        height: { type: "integer", minimum: 100, maximum: 10000 },
        border: { type: "integer", minimum: 0, maximum: 500, default: 10 },
        transparent: { type: "boolean", default: false },
        page_index: { type: "integer", minimum: 0 },
        overwrite: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
  },
];

// ── XML/路径工具 ──

function normalizeOutputPath(filePath, extension = ".drawio") {
  if (!filePath || typeof filePath !== "string") throw new Error("A file path is required.");
  const expanded = filePath.startsWith("~/") || filePath.startsWith("~\\") ? path.join(os.homedir(), filePath.slice(2)) : filePath;
  const resolved = path.resolve(expanded);
  if (extension && path.extname(resolved).toLowerCase() !== extension.toLowerCase()) {
    throw new Error(`Expected a ${extension} path: ${resolved}`);
  }
  return resolved;
}

async function assertWritable(target, overwrite) {
  try {
    await fs.access(target);
    if (!overwrite) throw new Error(`Output already exists; pass overwrite=true to replace it: ${target}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
}

function parseAttributes(tag) {
  const attrs = {};
  const re = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(tag))) attrs[match[1]] = match[2] ?? match[3] ?? "";
  return attrs;
}

function decodeXml(value = "") {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function regexEscape(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setTagAttribute(tag, key, value) {
  const attrRe = new RegExp(`\\s${regexEscape(key)}\\s*=\\s*(?:"[^"]*"|'[^']*')`);
  if (value === undefined) return tag;
  if (value === null) return tag.replace(attrRe, "");
  const encoded = xmlEscape(value);
  if (attrRe.test(tag)) return tag.replace(attrRe, ` ${key}="${encoded}"`);
  return tag.replace(/\s*(\/?>)$/, ` ${key}="${encoded}" $1`);
}

function removeStyle(style, key) {
  const entries = ensureStyle(style).split(";").filter(Boolean);
  return entries.filter((entry) => entry.split("=", 1)[0] !== key).join(";") + (entries.length ? ";" : "");
}

// ── XML 修补/校验 ──

function patchCellBlock(block, patch) {
  const startEnd = block.indexOf(">");
  if (startEnd < 0) throw new Error(`Malformed mxCell '${patch.id}'.`);
  let startTag = block.slice(0, startEnd + 1);
  let remainder = block.slice(startEnd + 1);
  const attrs = parseAttributes(startTag);
  if (patch.label !== undefined) startTag = setTagAttribute(startTag, "value", patch.label);
  let style = patch.style !== undefined ? patch.style : decodeXml(attrs.style || "");
  if (patch.style_updates) {
    for (const [key, value] of Object.entries(patch.style_updates)) {
      style = value === null ? removeStyle(style, key) : setStyle(style, key, typeof value === "boolean" ? (value ? 1 : 0) : value);
    }
  }
  if (patch.style !== undefined || patch.style_updates) startTag = setTagAttribute(startTag, "style", ensureStyle(style));
  let updated = startTag + remainder;
  const geometryUpdates = ["x", "y", "width", "height"].filter((key) => patch[key] !== undefined);
  if (geometryUpdates.length) {
    const geometryRe = /<mxGeometry\b[^>]*>/;
    const geometryMatch = updated.match(geometryRe);
    if (!geometryMatch) throw new Error(`Cell '${patch.id}' has no mxGeometry to update.`);
    let geometryTag = geometryMatch[0];
    for (const key of geometryUpdates) geometryTag = setTagAttribute(geometryTag, key, patch[key]);
    updated = updated.replace(geometryRe, geometryTag);
  }
  return updated;
}

function patchDiagramXml(xml, patches) {
  let updated = xml;
  for (const patch of patches) {
    const id = regexEscape(patch.id);
    const cellRe = new RegExp(`<mxCell\\b(?=[^>]*\\bid\\s*=\\s*(?:"${id}"|'${id}'))[^>]*(?:\\/\\s*>|>[\\s\\S]*?<\\/mxCell>)`, "g");
    const matches = [...updated.matchAll(cellRe)];
    if (matches.length === 0) throw new Error(`Cell id '${patch.id}' was not found.`);
    if (matches.length > 1) throw new Error(`Cell id '${patch.id}' appears more than once; use full XML editing for multi-page duplicate ids.`);
    updated = updated.replace(cellRe, (block) => patchCellBlock(block, patch));
  }
  return updated;
}

function inspectXml(xml) {
  const errors = [];
  const warnings = [];
  if (Buffer.byteLength(xml, "utf8") > MAX_XML_BYTES) errors.push(`XML exceeds ${MAX_XML_BYTES} bytes.`);
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<mxfile\b/.test(xml)) errors.push("Document must begin with an <mxfile> root element.");
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/.test(xml)) errors.push("XML contains an unescaped ampersand.");
  for (const comment of xml.matchAll(/<!--([\s\S]*?)-->/g)) {
    if (comment[1].includes("--")) errors.push("XML comments may not contain '--'.");
  }

  const tokens = xml.match(/<[^>]+>/g) || [];
  const stack = [];
  const pages = [];
  let currentPage = null;
  let currentCell = null;

  for (const token of tokens) {
    if (/^<\?|^<!/.test(token)) continue;
    const closing = token.match(/^<\/\s*([\w:.-]+)/);
    if (closing) {
      const expected = stack.pop();
      if (!expected || expected.name !== closing[1]) errors.push(`Mismatched closing tag </${closing[1]}>.`);
      if (closing[1] === "mxCell") currentCell = stack.toReversed().find((x) => x.name === "mxCell")?.cell || null;
      if (closing[1] === "diagram") currentPage = null;
      continue;
    }
    const opening = token.match(/^<\s*([\w:.-]+)/);
    if (!opening) continue;
    const name = opening[1];
    const selfClosing = /\/\s*>$/.test(token);
    const attrs = parseAttributes(token);
    const entry = { name };

    if (name === "diagram") {
      currentPage = { id: attrs.id || "", name: decodeXml(attrs.name || ""), cells: [], order: [] };
      pages.push(currentPage);
      if (!currentPage.id) errors.push("Every <diagram> needs a non-empty id attribute.");
    } else if (name === "mxCell" && currentPage) {
      const cell = {
        id: attrs.id,
        value: decodeXml(attrs.value || ""),
        style: attrs.style || "",
        parent: attrs.parent,
        source: attrs.source,
        target: attrs.target,
        vertex: attrs.vertex === "1",
        edge: attrs.edge === "1",
        geometry: null,
        hasSourcePoint: false,
        hasTargetPoint: false,
      };
      currentPage.cells.push(cell);
      currentPage.order.push(cell.id);
      currentCell = cell;
      entry.cell = cell;
    } else if (name === "mxGeometry" && currentCell) {
      currentCell.geometry = {
        x: attrs.x === undefined ? undefined : Number(attrs.x),
        y: attrs.y === undefined ? undefined : Number(attrs.y),
        width: attrs.width === undefined ? undefined : Number(attrs.width),
        height: attrs.height === undefined ? undefined : Number(attrs.height),
        relative: attrs.relative === "1",
      };
    } else if (name === "mxPoint" && currentCell) {
      if (attrs.as === "sourcePoint") currentCell.hasSourcePoint = true;
      if (attrs.as === "targetPoint") currentCell.hasTargetPoint = true;
    }

    if (!selfClosing) stack.push(entry);
    if (selfClosing && name === "mxCell") currentCell = stack.toReversed().find((x) => x.name === "mxCell")?.cell || null;
  }
  if (stack.length) errors.push(`Unclosed XML tags: ${stack.map((x) => x.name).join(", ")}.`);
  if (!pages.length) errors.push("No <diagram> pages found. Compressed draw.io pages are not accepted; save as uncompressed XML.");

  for (const page of pages) {
    const ids = new Set();
    for (const cell of page.cells) {
      if (!cell.id) errors.push(`Page '${page.name || page.id}' has an mxCell without id.`);
      else if (ids.has(cell.id)) errors.push(`Page '${page.name || page.id}' has duplicate id '${cell.id}'.`);
      else ids.add(cell.id);
    }
    if (page.order[0] !== "0" || page.order[1] !== "1") errors.push(`Page '${page.name || page.id}' must start with cells id=0 and id=1.`);
    const root1 = page.cells.find((c) => c.id === "1");
    if (!root1 || root1.parent !== "0") errors.push(`Page '${page.name || page.id}' requires cell id=1 parent=0.`);
    for (const cell of page.cells) {
      if (cell.id !== "0" && cell.parent && !ids.has(cell.parent)) errors.push(`Cell '${cell.id}' has missing parent '${cell.parent}'.`);
      if (cell.vertex && !cell.geometry) errors.push(`Vertex '${cell.id}' is missing mxGeometry.`);
      if (cell.edge) {
        if (!cell.geometry) errors.push(`Edge '${cell.id}' is missing mxGeometry.`);
        const connected = cell.source && cell.target && ids.has(cell.source) && ids.has(cell.target);
        const floating = cell.hasSourcePoint && cell.hasTargetPoint;
        if (!connected && !floating) errors.push(`Edge '${cell.id}' needs valid source/target ids or sourcePoint/targetPoint.`);
      }
    }
    if (!page.cells.some((c) => c.vertex && /fontSize=(?:1[6-9]|[2-9]\d)/.test(c.style))) warnings.push(`Page '${page.name || page.id}' has no obvious title text cell.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    pages: pages.map((p) => ({
      id: p.id,
      name: p.name,
      cells: p.cells.length,
      vertices: p.cells.filter((c) => c.vertex).length,
      edges: p.cells.filter((c) => c.edge).length,
    })),
    _pages: pages,
  };
}

// ── 图片/图表生成 ──


async function drawioVersion() {
  try {
    const { stdout, stderr } = await execFileAsync(DRAWIO.executable, ["--version"], { timeout: 15000, windowsHide: true });
    return { available: true, path: DRAWIO.executable, detection: DRAWIO.source, version: `${stdout}${stderr}`.trim() || "unknown" };
  } catch (error) {
    return { available: false, path: DRAWIO.executable, detection: DRAWIO.source, error: `${error.message}. ${drawioInstallHint()}` };
  }
}

function defaultExportPath(input, format, embed) {
  const base = input.toLowerCase().endsWith(".drawio") ? input.slice(0, -7) : input;
  return embed && ["png", "svg", "pdf"].includes(format) ? `${base}.drawio.${format}` : `${base}.${format}`;
}

async function repairPng(filePath) {
  const png = await fs.readFile(filePath);
  const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  if (png.subarray(-12).equals(iend)) return false;
  if (png.subarray(-4).equals(Buffer.alloc(4))) await fs.appendFile(filePath, iend.subarray(4));
  else await fs.appendFile(filePath, iend);
  return true;
}

async function exportDiagram(args) {
  const input = normalizeOutputPath(args.input_path);
  await fs.access(input);
  const format = args.format;
  const output = path.resolve(args.output_path || defaultExportPath(input, format, Boolean(args.embed)));
  if (args.width && args.scale) throw new Error("Do not combine width and scale.");
  if (args.height && args.scale) throw new Error("Do not combine height and scale.");
  await assertWritable(output, args.overwrite);
  const argv = ["-x", "-f", format];
  if (args.embed) argv.push("-e");
  if (args.scale !== undefined) argv.push("-s", String(args.scale));
  if (args.width !== undefined) argv.push("--width", String(args.width));
  if (args.height !== undefined) argv.push("--height", String(args.height));
  if (args.border !== undefined) argv.push("-b", String(args.border));
  if (args.transparent && format === "png") argv.push("-t");
  if (args.page_index !== undefined) argv.push("--page-index", String(args.page_index));
  argv.push("-o", output, input);
  try {
    const { stdout, stderr } = await execFileAsync(DRAWIO.executable, argv, { timeout: 120000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    await fs.access(output);
    const repaired = Boolean(args.embed && format === "png") ? await repairPng(output) : false;
    const stat = await fs.stat(output);
    return { input_path: input, output_path: output, format, embed: Boolean(args.embed), repaired_png_iend: repaired, bytes: stat.size, drawio_output: `${stdout}${stderr}`.trim() };
  } catch (error) {
    await fs.rm(output, { force: true }).catch(() => {});
    throw new Error(`draw.io export failed: ${error.stderr || error.stdout || error.message}`);
  }
}

// ── 工具分发（适配 createMcpTransport 的 { value } 格式） ──

async function handleTool(name, args = {}) {
  let value;
  switch (name) {
    case "drawio_validate": {
      const input = normalizeOutputPath(args.input_path);
      const xml = await fs.readFile(input, "utf8");
      const { _pages, ...report } = inspectXml(xml);
      value = { input_path: input, ...report };
      break;
    }
    case "drawio_inspect": {
      const input = normalizeOutputPath(args.input_path);
      const xml = await fs.readFile(input, "utf8");
      const report = inspectXml(xml);
      const maxCells = args.max_cells || 200;
      value = {
        input_path: input,
        valid: report.valid,
        errors: report.errors,
        warnings: report.warnings,
        pages: report._pages.map((p) => ({
          id: p.id,
          name: p.name,
          cells: p.cells.slice(0, maxCells).map((c) => ({
            id: c.id,
            type: c.vertex ? "vertex" : c.edge ? "edge" : "container",
            label: c.value,
            parent: c.parent,
            source: c.source,
            target: c.target,
            geometry: c.geometry,
            style: c.style.length > 500 ? `${c.style.slice(0, 500)}...` : c.style,
          })),
          truncated: p.cells.length > maxCells,
        })),
      };
      break;
    }
    case "drawio_update_cells": {
      const input = normalizeOutputPath(args.input_path);
      const output = normalizeOutputPath(args.output_path || input);
      const xml = await fs.readFile(input, "utf8");
      const updated = patchDiagramXml(xml, args.patches);
      const overwrite = output === input ? true : Boolean(args.overwrite);
      const result = await writeValidatedXml(output, updated, overwrite);
      value = { ...result, input_path: input, patches_applied: args.patches.length };
      break;
    }
    case "drawio_export":
      value = await exportDiagram(args);
      break;
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
  return { value };
}

// ── 启动 MCP 传输层 ──

createMcpTransport({
  serverName: SERVER_NAME,
  instructions: "Use absolute paths. Visually analyze reference images first, then create editable draw.io geometry, export a non-embedded PNG preview, inspect it, iterate, and finally export an embedded deliverable.",
  tools,
  handleTool,
});
