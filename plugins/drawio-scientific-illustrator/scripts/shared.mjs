import { createInterface } from "node:readline";

// shared.mjs — 提取两个 MCP 服务器的公共代码
// 修复: xmlEscape 换行转义、ensureStyle 空值处理

export const SERVER_VERSION = "1.0.0";

export const SUPPORTED_PROTOCOLS = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);

// ── XML 工具 ──

export function xmlEscape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\r\n", "&#xa;")
    .replaceAll("\n", "&#xa;")
    .replaceAll("\r", "&#xa;");
}

// ── 样式工具 ──

export function ensureStyle(style) {
  if (!style) return "";
  return style.endsWith(";") ? style : `${style};`;
}

export function setStyle(style, key, value) {
  if (value === undefined || value === null) return style;
  const normalized = ensureStyle(style);
  const re = new RegExp(`(?:^|;)${key}=[^;]*;`);
  const entry = `${key}=${value};`;
  return re.test(normalized)
    ? normalized.replace(re, (m) => `${m.startsWith(";") ? ";" : ""}${entry}`)
    : `${normalized}${entry}`;
}

const SHAPE_MAP = {
  rectangle: "rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontColor=#1f2937;",
  rounded: "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontColor=#1f2937;",
  ellipse: "ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontColor=#1f2937;",
  diamond: "rhombus;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontColor=#1f2937;",
  cylinder: "shape=cylinder3;boundedLbl=1;backgroundOutline=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontColor=#1f2937;",
  hexagon: "shape=hexagon;perimeter=hexagonPerimeter2;fixedSize=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontColor=#1f2937;",
  triangle: "triangle;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontColor=#1f2937;",
  parallelogram: "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontColor=#1f2937;",
  cloud: "ellipse;shape=cloud;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontColor=#1f2937;",
  text: "text;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;html=1;fontColor=#1f2937;",
  image: "shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;html=1;",
  group: "group;pointerEvents=0;",
  swimlane: "swimlane;startSize=30;rounded=0;html=1;whiteSpace=wrap;fillColor=#f5f5f5;strokeColor=#666666;",
};

// shapeStyle: 支持内置形状 + draw.io stencil 透传（如 mxgraph.aws4.lambda_function）
export function shapeStyle(shape = "rounded") {
  if (SHAPE_MAP[shape]) return SHAPE_MAP[shape];
  // stencil 透传：含 "." 表示第三方模板（AWS/Azure/GCP/BPMN 等）
  if (shape.includes(".")) return `shape=${shape};whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontColor=#1f2937;`;
  return SHAPE_MAP.rounded;
}

// ── MCP JSON-RPC 工具 ──

export function rpcError(id, code, message, data) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

export function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

// toolResult: 支持可选的 imageData（用于截图）
export function toolResult(value, { imageData, isError = false } = {}) {
  const content = [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }];
  if (imageData) content.push({ type: "image", data: imageData, mimeType: "image/png" });
  return {
    content,
    ...(typeof value === "object" && value !== null ? { structuredContent: value } : {}),
    isError,
  };
}

// ── MCP 传输层（stdin/stdout JSON-RPC） ──

export function createMcpTransport({ serverName, instructions, tools, handleTool }) {
  async function handleMessage(message) {
    const { id, method, params } = message;
    if (method === "initialize") {
      const requested = params?.protocolVersion;
      return rpcResult(id, {
        protocolVersion: SUPPORTED_PROTOCOLS.has(requested) ? requested : "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: serverName, version: SERVER_VERSION },
        instructions,
      });
    }
    if (method === "ping") return rpcResult(id, {});
    if (method === "tools/list") return rpcResult(id, { tools });
    if (method === "tools/call") {
      try {
        const result = await handleTool(params?.name, params?.arguments || {});
        return rpcResult(id, toolResult(result.value, { imageData: result.imageData }));
      } catch (error) {
        return rpcResult(id, toolResult({ error: error.message, tool: params?.name }, { isError: true }));
      }
    }
    if (method?.startsWith("notifications/")) return null;
    return rpcError(id, -32601, `Method not found: ${method}`);
  }

  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      process.stdout.write(`${JSON.stringify(rpcError(null, -32700, "Parse error", error.message))}\n`);
      return;
    }
    try {
      const response = await handleMessage(message);
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    } catch (error) {
      process.stdout.write(`${JSON.stringify(rpcError(message.id, -32603, "Internal error", error.message))}\n`);
    }
  });

  process.on("uncaughtException", (error) => process.stderr.write(`[${serverName}] ${error.stack || error.message}\n`));
  process.on("unhandledRejection", (error) => process.stderr.write(`[${serverName}] ${error?.stack || error}\n`));
}
