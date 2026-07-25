#!/usr/bin/env node

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";

import {
  SERVER_VERSION, xmlEscape, ensureStyle, setStyle, shapeStyle,
  rpcError, toolResult, createMcpTransport,
} from "./shared.mjs";
import { drawioInstallHint, resolveDrawioExecutable } from "./drawio-path.mjs";

const SERVER_NAME = "drawio-live";
const DRAWIO = resolveDrawioExecutable();
const DEFAULT_PORT = Number(process.env.DRAWIO_LIVE_PORT || 9333);
const PROFILE_ROOT = process.env.DRAWIO_LIVE_PROFILE || path.join(os.homedir(), ".drawio-live-mcp");

const live = {
  process: null,
  cdp: null,
  port: DEFAULT_PORT,
  target: null,
  stepDelayMs: 350,
};

const DEFAULT_EDGE_STYLE =
  "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=1;";

const pointSchema = {
  type: "object",
  required: ["x", "y"],
  properties: { x: { type: "number" }, y: { type: "number" } },
  additionalProperties: false,
};

const shapeProperties = {
  id: { type: "string", description: "Stable cell id used by later edges/updates." },
  label: { type: "string", default: "" },
  shape: {
    type: "string",
    description: "Shape name. Built-in: rectangle, rounded, ellipse, diamond, cylinder, hexagon, triangle, parallelogram, cloud, text, swimlane. Also accepts draw.io stencil names like mxgraph.aws4.lambda_function, mxgraph.azure.cognitive_services, etc. Use drawio_live_search_shapes to discover available stencil names.",
    default: "rounded",
  },
  x: { type: "number" },
  y: { type: "number" },
  width: { type: "number", exclusiveMinimum: 0 },
  height: { type: "number", exclusiveMinimum: 0 },
  style: { type: "string", description: "Full draw.io style override." },
  fill_color: { type: "string" },
  stroke_color: { type: "string" },
  font_color: { type: "string" },
  font_size: { type: "number", minimum: 1, maximum: 200 },
  stroke_width: { type: "number", minimum: 0, maximum: 50 },
};

const tools = [
  {
    name: "drawio_live_launch",
    description:
      "Launch or connect to a visible draw.io desktop window with a localhost-only debugging channel. Shapes added through the live tools appear immediately on screen. This does not pre-generate a diagram file.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Optional existing .drawio file to open visibly." },
        port: { type: "integer", minimum: 1024, maximum: 65535, default: 9333 },
        step_delay_ms: { type: "integer", minimum: 0, maximum: 10000, default: 350 },
        maximize: { type: "boolean", default: true },
        include_screenshot: { type: "boolean", default: true },
      },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_status",
    description: "Report whether the visible draw.io editor and live graph are ready, including page title, viewport, zoom, and cell counts.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "drawio_live_screenshot",
    description: "Capture the current visible draw.io renderer so the model can decide the next drawing action and the user can review progress.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "drawio_live_clear",
    description: "Remove the current page's drawable cells in the visible editor to start a blank live drawing. The change is visible and undoable in draw.io.",
    inputSchema: {
      type: "object",
      properties: { confirm: { type: "boolean", description: "Must be true because this removes current page content." } },
      required: ["confirm"],
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_add_shape",
    description: "Add one editable shape directly to the currently visible draw.io canvas. The shape appears immediately; no XML file is opened.",
    inputSchema: {
      type: "object",
      required: ["id", "x", "y", "width", "height"],
      properties: { ...shapeProperties, pause_after_ms: { type: "integer", minimum: 0, maximum: 10000 } },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_add_edge",
    description: "Add one editable connector directly between two visible draw.io cells. The edge appears immediately.",
    inputSchema: {
      type: "object",
      required: ["id", "source", "target"],
      properties: {
        id: { type: "string" },
        source: { type: "string" },
        target: { type: "string" },
        label: { type: "string", default: "" },
        style: { type: "string" },
        color: { type: "string" },
        width: { type: "number", minimum: 0, maximum: 50 },
        dashed: { type: "boolean" },
        curved: { type: "boolean" },
        start_arrow: { type: "string" },
        end_arrow: { type: "string" },
        exit_x: { type: "number", minimum: 0, maximum: 1 },
        exit_y: { type: "number", minimum: 0, maximum: 1 },
        entry_x: { type: "number", minimum: 0, maximum: 1 },
        entry_y: { type: "number", minimum: 0, maximum: 1 },
        waypoints: { type: "array", maxItems: 100, items: pointSchema },
        pause_after_ms: { type: "integer", minimum: 0, maximum: 10000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_update_cell",
    description: "Change one existing visible cell's label, full style, position, or size in place. The edit appears immediately and participates in draw.io undo.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        label: { type: "string" },
        style: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number", exclusiveMinimum: 0 },
        height: { type: "number", exclusiveMinimum: 0 },
        pause_after_ms: { type: "integer", minimum: 0, maximum: 10000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_draw_sequence",
    description:
      "Execute a paced sequence of shape, edge, update, fit, and wait operations in the visible draw.io editor. Each operation is applied separately with a delay so the user can watch the drawing process.",
    inputSchema: {
      type: "object",
      required: ["operations"],
      properties: {
        operations: {
          type: "array",
          minItems: 1,
          maxItems: 500,
          items: { type: "object", description: "An operation with type: shape, edge, update, fit, or wait." },
        },
        step_delay_ms: { type: "integer", minimum: 0, maximum: 10000 },
        screenshot_after: { type: "boolean", default: true },
      },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_fit",
    description: "Fit the current live diagram into the visible draw.io window or set a specific zoom percentage.",
    inputSchema: {
      type: "object",
      properties: { zoom_percent: { type: "number", minimum: 10, maximum: 800 } },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_inspect",
    description: "Read a compact inventory of cells from the currently visible draw.io model for subsequent live edits.",
    inputSchema: {
      type: "object",
      properties: { max_cells: { type: "integer", minimum: 1, maximum: 2000, default: 500 } },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_save_snapshot",
    description:
      "Save the current already-visible live draw.io model to an uncompressed .drawio file. This serializes the canvas after live drawing; it does not construct XML first and then open it.",
    inputSchema: {
      type: "object",
      required: ["output_path"],
      properties: {
        output_path: { type: "string" },
        page_name: { type: "string", default: "Live drawing" },
        overwrite: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_delete_cells",
    description: "Delete specific cells (shapes or edges) from the visible draw.io canvas by their ids. Requires confirm=true as a safety guard.",
    inputSchema: {
      type: "object",
      required: ["cell_ids", "confirm"],
      properties: {
        cell_ids: { type: "array", items: { type: "string" }, description: "Array of cell ids to delete." },
        confirm: { type: "boolean", description: "Must be true to confirm deletion." },
        pause_after_ms: { type: "integer", minimum: 0, maximum: 10000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_undo",
    description: "Undo the last operation in the visible draw.io editor.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "drawio_live_redo",
    description: "Redo the last undone operation in the visible draw.io editor.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "drawio_live_list_pages",
    description: "List all pages (sheets) in the current draw.io document, indicating which one is active.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "drawio_live_add_page",
    description: "Add a new page (sheet) to the draw.io document and switch to it.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: { name: { type: "string", description: "Name for the new page." } },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_switch_page",
    description: "Switch the visible draw.io editor to a different page (sheet) by its id.",
    inputSchema: {
      type: "object",
      required: ["page_id"],
      properties: { page_id: { type: "string", description: "The id of the page to switch to." } },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_order_cell",
    description: "Change the z-order of a cell — bring it to the front or send it to the back of overlapping cells.",
    inputSchema: {
      type: "object",
      required: ["cell_id", "order"],
      properties: {
        cell_id: { type: "string", description: "The id of the cell to reorder." },
        order: { type: "string", enum: ["front", "back"], description: "front = bring to top, back = send to bottom." },
        pause_after_ms: { type: "integer", minimum: 0, maximum: 10000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_duplicate_cell",
    description: "Duplicate an existing cell with an optional position offset. The new cell gets a '_copy' suffix on the original id.",
    inputSchema: {
      type: "object",
      required: ["cell_id"],
      properties: {
        cell_id: { type: "string", description: "The id of the cell to duplicate." },
        new_id: { type: "string", description: "Optional custom id for the copy. Defaults to '{cell_id}_copy'." },
        dx: { type: "number", default: 20, description: "Horizontal offset for the copy." },
        dy: { type: "number", default: 20, description: "Vertical offset for the copy." },
        pause_after_ms: { type: "integer", minimum: 0, maximum: 10000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "drawio_live_search_shapes",
    description: "Search draw.io's built-in stencil library by keyword. Returns matching shape names that can be used as the 'shape' parameter in drawio_live_add_shape.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Keyword to search for (e.g. 'lambda', 'database', 'router', 'kubernetes'). Matches against shape name, label, and tags." },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20, description: "Max results to return." },
      },
      additionalProperties: false,
    },
  },
];

// ── CDP 客户端 ──

class CdpClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to draw.io debugging channel.")), 10000);
      this.ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Failed to connect to draw.io debugging channel.")); }, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
      else pending.resolve(message.result);
    });
    this.ws.addEventListener("close", () => {
      for (const p of this.pending.values()) p.reject(new Error("draw.io debugging channel closed."));
      this.pending.clear();
    });
  }

  call(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error("draw.io live session is not connected.");
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP method timed out: ${method}`));
      }, 30000);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── CDP 连接管理 ──

async function jsonEndpoint(port, endpoint) {
  const r = await fetch(`http://127.0.0.1:${port}${endpoint}`, { signal: AbortSignal.timeout(2000) });
  if (!r.ok) throw new Error(`Debug endpoint returned ${r.status}.`);
  return r.json();
}

async function findTarget(port) {
  const targets = await jsonEndpoint(port, "/json/list");
  return targets.filter((t) => t.type === "page" && t.webSocketDebuggerUrl)
    .find((t) => /draw\.io|diagrams\.net/i.test(`${t.title} ${t.url}`)) || null;
}

async function canListen(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.unref();
    s.once("error", () => resolve(false));
    s.listen({ host: "127.0.0.1", port }, () => s.close(() => resolve(true)));
  });
}

async function findAvailablePort(startPort) {
  for (let p = startPort; p < Math.min(65535, startPort + 100); p++) {
    if (await canListen(p)) return p;
  }
  throw new Error(`No free localhost port found near ${startPort}.`);
}

async function waitForTarget(port, timeoutMs = 25000) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const t = await findTarget(port);
      if (t) return t;
    } catch (e) { lastErr = e; }
    await sleep(500);
  }
  throw new Error(`draw.io opened but no debuggable editor page appeared.${lastErr ? ` ${lastErr.message}` : ""}`);
}

async function connectTarget(target) {
  if (live.cdp?.ws?.readyState === WebSocket.OPEN && live.target?.id === target.id) return;
  try { live.cdp?.ws?.close(); } catch {}
  live.cdp = new CdpClient(target.webSocketDebuggerUrl);
  await live.cdp.connect();
  live.target = target;
  await live.cdp.call("Runtime.enable");
  await live.cdp.call("Page.enable");
  await live.cdp.call("Page.bringToFront").catch(() => {});
  await sleep(300);
  await recoverGraphReference().catch(() => false);
}

async function ensureConnected() {
  if (live.cdp?.ws?.readyState === WebSocket.OPEN) return;
  const t = await waitForTarget(live.port, 5000);
  await connectTarget(t);
}

// ── draw.io 图模型操作 ──

async function evaluate(expression, { awaitPromise = true } = {}) {
  await ensureConnected();
  const result = await live.cdp.call("Runtime.evaluate", {
    expression, awaitPromise, returnByValue: true, userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "draw.io evaluation failed.");
  }
  return result.result?.value;
}

async function getRemoteProperties(objectId, ownProperties = true) {
  return live.cdp.call("Runtime.getProperties", {
    objectId, ownProperties, accessorPropertiesOnly: false, generatePreview: true,
  });
}

async function bindRemoteGraph(objectId) {
  const r = await live.cdp.call("Runtime.callFunctionOn", {
    objectId,
    functionDeclaration: "function(){ window.__codexDrawioGraph = this; return !!(this && this.getModel && this.insertVertex); }",
    returnByValue: true, userGesture: true,
  });
  return r.result?.value === true;
}

async function recoverGraphReference() {
  const existing = await live.cdp.call("Runtime.evaluate", {
    expression: "!!(window.__codexDrawioGraph && window.__codexDrawioGraph.getModel && window.__codexDrawioGraph.insertVertex)",
    returnByValue: true,
  });
  if (existing.result?.value === true) return true;

  const listeners = await live.cdp.call("Runtime.evaluate", {
    expression: "document.querySelector('.geDiagramContainer')?.mxListenerList?.map((item) => item.f).filter(Boolean) || []",
    returnByValue: false,
  });
  const listId = listeners.result?.objectId;
  if (!listId) return false;
  const listProps = await getRemoteProperties(listId, true);
  const functions = listProps.result.filter((p) => /^\d+$/.test(p.name) && p.value?.objectId).slice(0, 40);

  for (const fnProp of functions) {
    const fnProps = await getRemoteProperties(fnProp.value.objectId, false);
    const scopesId = fnProps.internalProperties?.find((p) => p.name === "[[Scopes]]")?.value?.objectId;
    if (!scopesId) continue;
    const scopeList = await getRemoteProperties(scopesId, true);
    for (const scopeProp of scopeList.result.filter((p) => /^\d+$/.test(p.name) && p.value?.objectId && /Closure/i.test(p.value.description || ""))) {
      const scope = await getRemoteProperties(scopeProp.value.objectId, true);
      for (const variable of scope.result) {
        const remote = variable.value;
        if (!remote?.objectId || remote.type !== "object") continue;
        if (remote.className === "Graph" && await bindRemoteGraph(remote.objectId)) return true;
        if (!/^(?:mxCellEditor|EditorUi|Editor|Graph|Object)$/.test(remote.className || "") && variable.name !== "a") continue;
        const objectProps = await getRemoteProperties(remote.objectId, true).catch(() => null);
        const graphProp = objectProps?.result?.find((p) => p.name === "graph" && p.value?.objectId && p.value.className === "Graph");
        if (graphProp && await bindRemoteGraph(graphProp.value.objectId)) return true;
      }
    }
  }
  return false;
}

const graphLookup = `
  const __findUi = () => {
    for (const key of ['ui', 'editorUi', 'app']) {
      try { if (window[key] && window[key].editor && window[key].editor.graph) return window[key]; } catch {}
    }
    for (const key of Object.keys(window)) {
      try {
        const value = window[key];
        if (value && value.editor && value.editor.graph && value.editor.graph.getModel) return value;
      } catch {}
    }
    return null;
  };
  const ui = __findUi();
  const graph = window.__codexDrawioGraph || (ui && ui.editor && ui.editor.graph);
  if (!graph) throw new Error('The draw.io editor graph is not ready.');
`;

async function graphEval(body) {
  await ensureConnected();
  await recoverGraphReference();
  return evaluate(`(() => { ${graphLookup} ${body} })()`);
}

// ── 实时操作 ──

async function liveStatus() {
  await ensureConnected();
  await recoverGraphReference().catch(() => false);
  return evaluate(`(() => {
    const foundUi = (() => {
      for (const key of ['ui', 'editorUi', 'app']) { try { if (window[key]?.editor?.graph) return window[key]; } catch {} }
      for (const key of Object.keys(window)) { try { if (window[key]?.editor?.graph?.getModel) return window[key]; } catch {} }
      return null;
    })();
    const graph = window.__codexDrawioGraph || foundUi?.editor?.graph;
    const base = { title: document.title, url: location.href, viewport: { width: innerWidth, height: innerHeight }, graph_ready: !!graph, control_scope: 'draw.io graph API only' };
    if (!graph) return base;
    const parent = graph.getDefaultParent();
    return { ...base, zoom_percent: Math.round(graph.view.scale * 100), vertices: graph.getChildVertices(parent).length, edges: graph.getChildEdges(parent).length };
  })()`);
}

async function captureScreenshot() {
  await ensureConnected();
  const { data } = await live.cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  return data;
}

function edgeStyle(args) {
  let style = args.style || DEFAULT_EDGE_STYLE;
  style = setStyle(style, "strokeColor", args.color);
  style = setStyle(style, "strokeWidth", args.width);
  if (args.dashed !== undefined) style = setStyle(style, "dashed", args.dashed ? 1 : 0);
  if (args.curved !== undefined) style = setStyle(style, "curved", args.curved ? 1 : 0);
  style = setStyle(style, "startArrow", args.start_arrow);
  style = setStyle(style, "endArrow", args.end_arrow);
  style = setStyle(style, "exitX", args.exit_x);
  style = setStyle(style, "exitY", args.exit_y);
  style = setStyle(style, "entryX", args.entry_x);
  style = setStyle(style, "entryY", args.entry_y);
  return ensureStyle(style);
}

async function addShape(args) {
  let style = args.style || shapeStyle(args.shape);
  style = setStyle(style, "fillColor", args.fill_color);
  style = setStyle(style, "strokeColor", args.stroke_color);
  style = setStyle(style, "fontColor", args.font_color);
  style = setStyle(style, "fontSize", args.font_size);
  style = setStyle(style, "strokeWidth", args.stroke_width);
  const payload = JSON.stringify({ ...args, style: ensureStyle(style) });
  const value = await graphEval(`
    const a = ${payload};
    if (graph.getModel().getCell(a.id)) throw new Error('Cell id already exists: ' + a.id);
    const parent = graph.getDefaultParent();
    let cell;
    graph.getModel().beginUpdate();
    try { cell = graph.insertVertex(parent, a.id, a.label || '', Number(a.x), Number(a.y), Number(a.width), Number(a.height), a.style); }
    finally { graph.getModel().endUpdate(); }
    graph.setSelectionCell(cell);
    graph.scrollCellToVisible(cell);
    return { id: cell.id, label: graph.convertValueToString(cell), geometry: cell.geometry, style: cell.style };
  `);
  await sleep(args.pause_after_ms ?? live.stepDelayMs);
  return value;
}

async function addEdge(args) {
  const payload = JSON.stringify({ ...args, style: edgeStyle(args) });
  const value = await graphEval(`
    const a = ${payload};
    const model = graph.getModel();
    if (model.getCell(a.id)) throw new Error('Cell id already exists: ' + a.id);
    const source = model.getCell(a.source);
    const target = model.getCell(a.target);
    if (!source || !target) throw new Error('Missing edge endpoint: ' + (!source ? a.source : a.target));
    const parent = graph.getDefaultParent();
    let edge;
    model.beginUpdate();
    try {
      edge = graph.insertEdge(parent, a.id, a.label || '', source, target, a.style);
      if (a.waypoints && a.waypoints.length) {
        const geo = edge.getGeometry().clone();
        geo.points = a.waypoints.map((p) => new mxPoint(Number(p.x), Number(p.y)));
        model.setGeometry(edge, geo);
      }
    } finally { model.endUpdate(); }
    graph.setSelectionCell(edge);
    return { id: edge.id, source: source.id, target: target.id, label: graph.convertValueToString(edge), style: edge.style };
  `);
  await sleep(args.pause_after_ms ?? live.stepDelayMs);
  return value;
}

async function updateCell(args) {
  const payload = JSON.stringify(args);
  const value = await graphEval(`
    const a = ${payload};
    const model = graph.getModel();
    const cell = model.getCell(a.id);
    if (!cell) throw new Error('Cell not found: ' + a.id);
    model.beginUpdate();
    try {
      if (a.label !== undefined) graph.cellLabelChanged(cell, a.label, false);
      if (a.style !== undefined) model.setStyle(cell, a.style);
      if (a.x !== undefined || a.y !== undefined || a.width !== undefined || a.height !== undefined) {
        if (!cell.geometry) throw new Error('Cell has no geometry: ' + a.id);
        const geo = cell.geometry.clone();
        if (a.x !== undefined) geo.x = Number(a.x);
        if (a.y !== undefined) geo.y = Number(a.y);
        if (a.width !== undefined) geo.width = Number(a.width);
        if (a.height !== undefined) geo.height = Number(a.height);
        model.setGeometry(cell, geo);
      }
    } finally { model.endUpdate(); }
    graph.setSelectionCell(cell);
    graph.scrollCellToVisible(cell);
    return { id: cell.id, label: graph.convertValueToString(cell), geometry: cell.geometry, style: cell.style };
  `);
  await sleep(args.pause_after_ms ?? live.stepDelayMs);
  return value;
}

async function deleteCells(args) {
  if (args.confirm !== true) throw new Error("confirm=true is required to delete cells.");
  const payload = JSON.stringify(args.cell_ids);
  const value = await graphEval(`
    const ids = ${payload};
    const model = graph.getModel();
    const cells = ids.map(id => model.getCell(id)).filter(Boolean);
    if (!cells.length) throw new Error('No valid cells found for given ids.');
    graph.removeCells(cells, true);
    graph.clearSelection();
    return { deleted: cells.length, ids: cells.map(c => c.id) };
  `);
  await sleep(args.pause_after_ms ?? live.stepDelayMs);
  return value;
}

async function undoAction() {
  return graphEval(`
    const um = graph.undoManager;
    if (!um || !um.canUndo()) return { undone: false, reason: 'nothing to undo' };
    graph.undo();
    return { undone: true };
  `);
}

async function redoAction() {
  return graphEval(`
    const um = graph.undoManager;
    if (!um || !um.canRedo()) return { redone: false, reason: 'nothing to redo' };
    graph.redo();
    return { redone: true };
  `);
}

async function listPages() {
  return graphEval(`
    const editor = (window.__codexDrawioGraph && window.__codexDrawioGraph.editor) ||
      (() => { for (const k of ['ui','editorUi','app']) { try { if (window[k]?.editor) return window[k].editor; } catch {} } return null; })();
    const pages = (editor && editor.pages) || [];
    const currentPage = (editor && editor.currentPage) || null;
    return {
      pages: pages.map(p => ({ id: p.getId(), name: p.getName(), active: p === currentPage })),
      current_page_id: currentPage ? currentPage.getId() : null,
      total: pages.length
    };
  `);
}

async function addPage(args) {
  return graphEval(`
    const editor = (window.__codexDrawioGraph && window.__codexDrawioGraph.editor) ||
      (() => { for (const k of ['ui','editorUi','app']) { try { if (window[k]?.editor) return window[k].editor; } catch {} } return null; })();
    if (!editor) throw new Error('Editor not found');
    if (!editor.addPage) throw new Error('addPage is not supported in this draw.io version');
    const page = editor.addPage(${JSON.stringify(args.name)});
    return { id: page.getId(), name: page.getName(), created: true };
  `);
}

async function switchPage(args) {
  const payload = JSON.stringify(args.page_id);
  return graphEval(`
    const targetId = ${payload};
    const editor = (window.__codexDrawioGraph && window.__codexDrawioGraph.editor) ||
      (() => { for (const k of ['ui','editorUi','app']) { try { if (window[k]?.editor) return window[k].editor; } catch {} } return null; })();
    if (!editor) throw new Error('Editor not found');
    const pages = editor.pages || [];
    const page = pages.find(p => p.getId() === targetId);
    if (!page) throw new Error('Page not found: ' + targetId);
    editor.setPage(page);
    return { id: page.getId(), name: page.getName(), switched: true };
  `);
}

async function orderCell(args) {
  const payload = JSON.stringify(args);
  const value = await graphEval(`
    const a = ${payload};
    const model = graph.getModel();
    const cell = model.getCell(a.cell_id);
    if (!cell) throw new Error('Cell not found: ' + a.cell_id);
    graph.orderCells(a.order === 'front', [cell]);
    return { id: cell.id, order: a.order };
  `);
  await sleep(args.pause_after_ms ?? live.stepDelayMs);
  return value;
}

async function duplicateCell(args) {
  const payload = JSON.stringify(args);
  const value = await graphEval(`
    const a = ${payload};
    const model = graph.getModel();
    const src = model.getCell(a.cell_id);
    if (!src) throw new Error('Cell not found: ' + a.cell_id);
    const newId = a.new_id || (a.cell_id + '_copy');
    if (model.getCell(newId)) throw new Error('Cell id already exists: ' + newId);
    const parent = graph.getDefaultParent();
    const dx = Number(a.dx || 20), dy = Number(a.dy || 20);
    let copy;
    model.beginUpdate();
    try {
      const geo = src.geometry ? src.geometry.clone() : null;
      if (geo) { geo.x += dx; geo.y += dy; }
      copy = graph.insertVertex(parent, newId, graph.convertValueToString(src),
        geo ? geo.x : 0, geo ? geo.y : 0,
        geo ? geo.width : 120, geo ? geo.height : 60, src.style || '');
    } finally { model.endUpdate(); }
    graph.setSelectionCell(copy);
    graph.scrollCellToVisible(copy);
    return { id: copy.id, source: src.id, geometry: copy.geometry, style: copy.style };
  `);
  await sleep(args.pause_after_ms ?? live.stepDelayMs);
  return value;
}

async function fitView(zoomPercent) {
  return graphEval(`
    const zoom = ${zoomPercent === undefined ? "null" : Number(zoomPercent)};
    if (zoom == null) graph.fit(20, false, 20, true, false, true);
    else graph.zoomTo(zoom / 100, true);
    return { zoom_percent: Math.round(graph.view.scale * 100) };
  `);
}

// ── 形状搜索 ──

const BUILTIN_SHAPES = [
  // AWS
  { shape: "mxgraph.aws4.lambda_function", label: "AWS Lambda", tags: "aws function serverless compute" },
  { shape: "mxgraph.aws4.api_gateway", label: "AWS API Gateway", tags: "aws api gateway rest" },
  { shape: "mxgraph.aws4.ec2", label: "AWS EC2", tags: "aws ec2 virtual machine server instance" },
  { shape: "mxgraph.aws4.s3", label: "AWS S3", tags: "aws s3 storage bucket object" },
  { shape: "mxgraph.aws4.rds", label: "AWS RDS", tags: "aws rds relational database sql" },
  { shape: "mxgraph.aws4.dynamodb", label: "AWS DynamoDB", tags: "aws dynamodb nosql database table" },
  { shape: "mxgraph.aws4.elasticache", label: "AWS ElastiCache", tags: "aws elasticache redis memcached cache" },
  { shape: "mxgraph.aws4.sqs", label: "AWS SQS", tags: "aws sqs queue message" },
  { shape: "mxgraph.aws4.sns", label: "AWS SNS", tags: "aws sns notification pubsub topic" },
  { shape: "mxgraph.aws4.cloudfront", label: "AWS CloudFront", tags: "aws cloudfront cdn" },
  { shape: "mxgraph.aws4.route_53", label: "AWS Route 53", tags: "aws route53 dns domain" },
  { shape: "mxgraph.aws4.vpc", label: "AWS VPC", tags: "aws vpc network virtual private cloud" },
  { shape: "mxgraph.aws4.elb", label: "AWS ELB", tags: "aws elb load balancer" },
  { shape: "mxgraph.aws4.cloudwatch", label: "AWS CloudWatch", tags: "aws cloudwatch monitoring metrics" },
  { shape: "mxgraph.aws4.iam", label: "AWS IAM", tags: "aws iam identity access" },
  { shape: "mxgraph.aws4.ecs", label: "AWS ECS", tags: "aws ecs container" },
  { shape: "mxgraph.aws4.eks", label: "AWS EKS", tags: "aws eks kubernetes" },
  { shape: "mxgraph.aws4.aurora", label: "AWS Aurora", tags: "aws aurora database" },
  { shape: "mxgraph.aws4.cloudformation", label: "AWS CloudFormation", tags: "aws cloudformation infrastructure template" },
  { shape: "mxgraph.aws4.step_functions", label: "AWS Step Functions", tags: "aws step functions workflow orchestration" },
  { shape: "mxgraph.aws4.eventbridge", label: "AWS EventBridge", tags: "aws eventbridge event bus" },
  { shape: "mxgraph.aws4.kinesis", label: "AWS Kinesis", tags: "aws kinesis stream data" },
  { shape: "mxgraph.aws4.emr", label: "AWS EMR", tags: "aws emr hadoop bigdata" },
  { shape: "mxgraph.aws4.sagemaker", label: "AWS SageMaker", tags: "aws sagemaker machine learning ai" },
  { shape: "mxgraph.aws4.secrets_manager", label: "AWS Secrets Manager", tags: "aws secrets vault credentials" },
  // Azure
  { shape: "mxgraph.azure.app_services", label: "Azure App Services", tags: "azure app web hosting" },
  { shape: "mxgraph.azure.azure_functions", label: "Azure Functions", tags: "azure function serverless" },
  { shape: "mxgraph.azure.cognitive_services", label: "Azure Cognitive Services", tags: "azure ai cognitive" },
  { shape: "mxgraph.azure.sql_database", label: "Azure SQL Database", tags: "azure sql database" },
  { shape: "mxgraph.azure.cosmos_db", label: "Azure Cosmos DB", tags: "azure cosmos nosql database" },
  { shape: "mxgraph.azure.blob_storage", label: "Azure Blob Storage", tags: "azure blob storage object" },
  { shape: "mxgraph.azure.virtual_machines", label: "Azure Virtual Machines", tags: "azure vm virtual machine" },
  { shape: "mxgraph.azure.kubernetes_services", label: "Azure Kubernetes Service", tags: "azure aks kubernetes container" },
  { shape: "mxgraph.azure.event_grid", label: "Azure Event Grid", tags: "azure event grid" },
  { shape: "mxgraph.azure.service_bus", label: "Azure Service Bus", tags: "azure service bus queue message" },
  { shape: "mxgraph.azure.redis_cache", label: "Azure Redis Cache", tags: "azure redis cache" },
  { shape: "mxgraph.azure.active_directory", label: "Azure Active Directory", tags: "azure ad active directory identity" },
  { shape: "mxgraph.azure.load_balancer", label: "Azure Load Balancer", tags: "azure load balancer" },
  { shape: "mxgraph.azure.virtual_network", label: "Azure Virtual Network", tags: "azure vnet virtual network" },
  { shape: "mxgraph.azure.azure_ai", label: "Azure AI", tags: "azure ai openai" },
  { shape: "mxgraph.azure.databricks", label: "Azure Databricks", tags: "azure databricks spark analytics" },
  // GCP
  { shape: "mxgraph.gcp.cloud_functions", label: "GCP Cloud Functions", tags: "gcp function serverless" },
  { shape: "mxgraph.gcp.cloud_run", label: "GCP Cloud Run", tags: "gcp cloud run container serverless" },
  { shape: "mxgraph.gcp.compute_engine", label: "GCP Compute Engine", tags: "gcp compute engine vm" },
  { shape: "mxgraph.gcp.cloud_storage", label: "GCP Cloud Storage", tags: "gcp storage bucket" },
  { shape: "mxgraph.gcp.cloud_sql", label: "GCP Cloud SQL", tags: "gcp cloud sql database" },
  { shape: "mxgraph.gcp.bigquery", label: "GCP BigQuery", tags: "gcp bigquery data warehouse analytics" },
  { shape: "mxgraph.gcp.pub_sub", label: "GCP Pub/Sub", tags: "gcp pubsub message queue" },
  { shape: "mxgraph.gcp.cloud_datastore", label: "GCP Datastore", tags: "gcp datastore nosql" },
  { shape: "mxgraph.gcp.kubernetes_engine", label: "GCP GKE", tags: "gcp gke kubernetes container" },
  { shape: "mxgraph.gcp.cloud_dns", label: "GCP Cloud DNS", tags: "gcp dns" },
  { shape: "mxgraph.gcp.load_balancing", label: "GCP Load Balancing", tags: "gcp load balancer" },
  { shape: "mxgraph.gcp.vertex_ai", label: "GCP Vertex AI", tags: "gcp vertex ai ml" },
  // Network / Cisco
  { shape: "mxgraph.cisco.routers.router", label: "Router", tags: "router network cisco" },
  { shape: "mxgraph.cisco.switches.switch", label: "Switch", tags: "switch network cisco" },
  { shape: "mxgraph.cisco.firewalls.firewall", label: "Firewall", tags: "firewall security cisco" },
  { shape: "mxgraph.cisco.servers.standard_server", label: "Server", tags: "server compute" },
  { shape: "mxgraph.cisco.storage.storage", label: "Storage Array", tags: "storage san nas disk array" },
  { shape: "mxgraph.network.server", label: "Network Server", tags: "server network rack" },
  { shape: "mxgraph.network.database", label: "Network Database", tags: "database network" },
  { shape: "mxgraph.network.cloud", label: "Cloud", tags: "cloud network internet" },
  { shape: "mxgraph.network.firewall", label: "Network Firewall", tags: "firewall security network" },
  { shape: "mxgraph.network.load_balancer", label: "Load Balancer", tags: "load balancer network" },
  { shape: "mxgraph.network.wifi", label: "WiFi", tags: "wifi wireless" },
  // Databases
  { shape: "shape=cylinder3", label: "Cylinder Database", tags: "database cylinder storage" },
  // BPMN
  { shape: "bpmn.startEvent", label: "BPMN Start Event", tags: "bpmn start event circle" },
  { shape: "bpmn.endEvent", label: "BPMN End Event", tags: "bpmn end event circle" },
  { shape: "bpmn.task", label: "BPMN Task", tags: "bpmn task rectangle" },
  { shape: "bpmn.gateway", label: "BPMN Gateway", tags: "bpmn gateway decision diamond" },
  { shape: "bpmn.pool", label: "BPMN Pool", tags: "bpmn pool swimlane" },
  { shape: "bpmn.dataObject", label: "BPMN Data Object", tags: "bpmn data document" },
  { shape: "bpmn.dataStore", label: "BPMN Data Store", tags: "bpmn data store database" },
  // UML
  { shape: "shape=umlClass;align=left", label: "UML Class", tags: "uml class box" },
  { shape: "shape=note2", label: "UML Note", tags: "uml note annotation" },
  { shape: "shape=umlActor", label: "UML Actor", tags: "uml actor person user stickman" },
  // Flowchart
  { shape: "shape=process", label: "Process", tags: "flowchart process" },
  { shape: "shape=terminator", label: "Terminator", tags: "flowchart start end terminator" },
  { shape: "shape=decision", label: "Decision", tags: "flowchart decision diamond" },
  { shape: "shape=data", label: "Data IO", tags: "flowchart data input output parallelogram" },
  { shape: "shape=document", label: "Document", tags: "flowchart document page" },
  // Kubernetes
  { shape: "shape=mxgraph.kubernetes.pod", label: "Kubernetes Pod", tags: "kubernetes k8s pod container" },
  { shape: "shape=mxgraph.kubernetes.deploy", label: "Kubernetes Deployment", tags: "kubernetes k8s deployment" },
  { shape: "shape=mxgraph.kubernetes.service", label: "Kubernetes Service", tags: "kubernetes k8s service" },
  { shape: "shape=mxgraph.kubernetes.cluster", label: "Kubernetes Cluster", tags: "kubernetes k8s cluster" },
  // Misc
  { shape: "shape=actor", label: "Actor", tags: "actor person user stickman" },
  { shape: "mxgraph.bootstrap.user", label: "User Icon", tags: "user person avatar" },
  { shape: "mxgraph.bootstrap.lock", label: "Lock Icon", tags: "lock security" },
  { shape: "mxgraph.bootstrap.key", label: "Key Icon", tags: "key security auth" },
  { shape: "mxgraph.bootstrap.gear", label: "Gear Icon", tags: "gear settings config" },
  { shape: "mxgraph.bootstrap.shield", label: "Shield Icon", tags: "shield security protection" },
  { shape: "mxgraph.bootstrap.database", label: "Bootstrap Database", tags: "database" },
  { shape: "mxgraph.bootstrap.cart", label: "Cart Icon", tags: "cart shopping ecommerce" },
  { shape: "mxgraph.signs.info", label: "Info Sign", tags: "info information sign" },
  { shape: "mxgraph.signs.warning", label: "Warning Sign", tags: "warning caution sign triangle" },
  { shape: "mxgraph.signs.error", label: "Error Sign", tags: "error sign circle" },
];

function searchShapes(args) {
  const query = (args.query || "").toLowerCase().trim();
  const limit = args.limit || 20;
  if (!query) return { query: "", results: [], total: 0, hint: "Provide a keyword like 'lambda', 'database', 'router'." };
  const keywords = query.split(/\s+/);
  const scored = [];
  for (const entry of BUILTIN_SHAPES) {
    const haystack = `${entry.shape} ${entry.label} ${entry.tags}`.toLowerCase();
    if (!keywords.every((kw) => haystack.includes(kw))) continue;
    let score = 1;
    if (entry.label.toLowerCase().includes(query)) score += 10;
    if (entry.shape.toLowerCase().includes(query)) score += 5;
    scored.push({ shape: entry.shape, label: entry.label, tags: entry.tags, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, limit).map(({ shape, label, tags }) => ({ shape, label, tags }));
  return { query, results, total: scored.length, limit };
}

// ── 启动 ──

async function launchLive(args) {
  live.port = args.port || DEFAULT_PORT;
  live.stepDelayMs = args.step_delay_ms ?? 350;
  let target = null;
  try { target = await findTarget(live.port); } catch {}
  if (!target) {
    if (!(await canListen(live.port))) {
      if (args.port) throw new Error(`Port ${live.port} is already in use by a non-draw.io process.`);
      live.port = await findAvailablePort(live.port + 1);
    }
    const profileDir = process.env.DRAWIO_LIVE_PROFILE || path.join(PROFILE_ROOT, String(live.port));
    await fs.mkdir(profileDir, { recursive: true });
    const argv = [
      `--remote-debugging-address=127.0.0.1`,
      `--remote-debugging-port=${live.port}`,
      `--user-data-dir=${profileDir}`,
      "--disable-features=CalculateNativeWinOcclusion",
    ];
    if (args.file_path) argv.push(path.resolve(args.file_path));
    live.process = spawn(DRAWIO.executable, argv, { detached: false, stdio: "ignore", windowsHide: false });
    await new Promise((resolve, reject) => {
      live.process.once("spawn", resolve);
      live.process.once("error", (e) => reject(new Error(`Unable to launch draw.io (${DRAWIO.executable}): ${e.message}. ${drawioInstallHint()}`)));
    });
    target = await waitForTarget(live.port);
  }
  await connectTarget(target);
  if (args.maximize !== false) {
    try {
      const r = await live.cdp.call("Browser.getWindowForTarget", { targetId: target.id });
      await live.cdp.call("Browser.setWindowBounds", { windowId: r.windowId, bounds: { windowState: "maximized" } });
    } catch {}
  }
  await sleep(1000);
  return { connected: true, port: live.port, drawio: DRAWIO, target: { id: target.id, title: target.title, url: target.url }, step_delay_ms: live.stepDelayMs, status: await liveStatus() };
}

// ── 工具分发 ──

async function handleTool(name, args = {}) {
  switch (name) {
    case "drawio_live_launch": {
      const result = await launchLive(args);
      return { value: result, imageData: args.include_screenshot === false ? undefined : await captureScreenshot() };
    }
    case "drawio_live_status":
      return { value: { connected: true, port: live.port, ...(await liveStatus()) } };
    case "drawio_live_screenshot":
      return { value: { ...(await liveStatus()), captured: true }, imageData: await captureScreenshot() };
    case "drawio_live_clear": {
      if (args.confirm !== true) throw new Error("confirm=true is required to clear the current page.");
      const value = await graphEval(`
        const parent = graph.getDefaultParent();
        const cells = graph.getChildCells(parent, true, true);
        graph.removeCells(cells, true);
        graph.clearSelection();
        return { removed: cells.length };
      `);
      await sleep(live.stepDelayMs);
      return { value };
    }
    case "drawio_live_add_shape":
      return { value: await addShape(args) };
    case "drawio_live_add_edge":
      return { value: await addEdge(args) };
    case "drawio_live_update_cell":
      return { value: await updateCell(args) };
    case "drawio_live_fit":
      return { value: await fitView(args.zoom_percent), imageData: await captureScreenshot() };
    case "drawio_live_draw_sequence": {
      const delay = args.step_delay_ms ?? live.stepDelayMs;
      const results = [];
      for (let i = 0; i < args.operations.length; i++) {
        const op = args.operations[i];
        if (op.type === "shape") results.push({ index: i, type: "shape", result: await addShape({ ...op, pause_after_ms: delay }) });
        else if (op.type === "edge") results.push({ index: i, type: "edge", result: await addEdge({ ...op, pause_after_ms: delay }) });
        else if (op.type === "update") results.push({ index: i, type: "update", result: await updateCell({ ...op, pause_after_ms: delay }) });
        else if (op.type === "fit") { results.push({ index: i, type: "fit", result: await fitView(op.zoom_percent) }); await sleep(delay); }
        else if (op.type === "wait") { const ms = Math.max(0, Math.min(10000, op.ms ?? delay)); await sleep(ms); results.push({ index: i, type: "wait", waited_ms: ms }); }
        else throw new Error(`Unsupported sequence operation at index ${i}: ${op.type}`);
      }
      return { value: { operations_applied: results.length, results }, imageData: args.screenshot_after === false ? undefined : await captureScreenshot() };
    }
    case "drawio_live_inspect": {
      const maxCells = args.max_cells || 500;
      const value = await graphEval(`
        const parent = graph.getDefaultParent();
        const cells = graph.getChildCells(parent, true, true);
        const plain = cells.slice(0, ${maxCells}).map((cell) => ({
          id: cell.id,
          type: cell.vertex ? 'vertex' : cell.edge ? 'edge' : 'cell',
          label: graph.convertValueToString(cell),
          source: cell.source?.id,
          target: cell.target?.id,
          geometry: cell.geometry ? { x: cell.geometry.x, y: cell.geometry.y, width: cell.geometry.width, height: cell.geometry.height, relative: cell.geometry.relative, points: cell.geometry.points?.map((p) => ({ x: p.x, y: p.y })) } : null,
          style: cell.style || '',
        }));
        return { cells: plain, total: cells.length, truncated: cells.length > ${maxCells}, zoom_percent: Math.round(graph.view.scale * 100) };
      `);
      return { value };
    }
    case "drawio_live_save_snapshot": {
      const output = path.resolve(args.output_path);
      if (path.extname(output).toLowerCase() !== ".drawio") throw new Error("output_path must end with .drawio");
      try {
        await fs.access(output);
        if (!args.overwrite) throw new Error(`Output exists; pass overwrite=true: ${output}`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const modelXml = await graphEval(`
        const codec = new mxCodec();
        const node = codec.encode(graph.getModel());
        return mxUtils.getXml(node);
      `);
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="Electron" modified="${new Date().toISOString()}" version="30.3.6">\n  <diagram id="live-page" name="${xmlEscape(args.page_name || "Live drawing")}">\n${modelXml}\n  </diagram>\n</mxfile>\n`;
      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.writeFile(output, xml, "utf8");
      return { value: { output_path: output, bytes: Buffer.byteLength(xml), saved_from_visible_session: true } };
    }
    case "drawio_live_delete_cells":
      return { value: await deleteCells(args) };
    case "drawio_live_undo":
      return { value: await undoAction() };
    case "drawio_live_redo":
      return { value: await redoAction() };
    case "drawio_live_list_pages":
      return { value: await listPages() };
    case "drawio_live_add_page":
      return { value: await addPage(args) };
    case "drawio_live_switch_page":
      return { value: await switchPage(args) };
    case "drawio_live_order_cell":
      return { value: await orderCell(args) };
    case "drawio_live_duplicate_cell":
      return { value: await duplicateCell(args) };
    case "drawio_live_search_shapes":
      return { value: searchShapes(args) };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── 启动 MCP 传输层 ──

createMcpTransport({
  serverName: SERVER_NAME,
  instructions: "Control only draw.io's own graph API. Launch the visible editor, then add shapes and edges one at a time or in a paced sequence so the user can watch every operation appear. Never use OS-level mouse, keyboard, or screen control. Save a .drawio snapshot only after live drawing.",
  tools,
  handleTool,
});
