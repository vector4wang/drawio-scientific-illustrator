#!/usr/bin/env node
// Direct MCP command executor for draw.io live drawing
import { spawn } from 'node:child_process';

const MCP_CWD = '/Users/wangxingchao/github/drawio-scientific-illustrator/plugins/drawio-scientific-illustrator';

let child;
let buffer = '';
let msgId = 0;
const pending = new Map();

function startServer() {
  child = spawn('node', ['scripts/live-server.mjs'], { cwd: MCP_CWD, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => {
    buffer += d.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      } catch (e) {}
    }
  });
  child.stderr.on('data', (d) => process.stderr.write('[MCP] ' + d.toString()));
}

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 20000);
    pending.set(id, (msg) => { clearTimeout(t); resolve(msg); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

async function callTool(name, args = {}) {
  const result = await send('tools/call', { name, arguments: args });
  return result;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function init() {
  startServer();
  await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'arch-drawer', version: '1.0' } });
  await send('notifications/initialized', {});
  console.log('[INIT] MCP server connected');
}

async function draw() {
  // Read commands from the JSON file
  const { readFileSync } = await import('node:fs');
  const commands = JSON.parse(readFileSync(process.argv[2] || './draw-commands.json', 'utf-8'));

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    console.log(`[${i+1}/${commands.length}] ${cmd.tool}: ${JSON.stringify(cmd.args).substring(0, 80)}`);
    const result = await callTool(cmd.tool, cmd.args);
    if (result.result) {
      const content = result.result.content;
      if (content) {
        const text = content.map(c => c.text || '').join('');
        if (text.includes('error') || text.includes('Error')) {
          console.log('  ⚠️', text.substring(0, 200));
        } else {
          console.log('  ✓', text.substring(0, 100));
        }
      }
    }
    if (cmd.delay) await sleep(cmd.delay);
    else await sleep(400); // default delay between shapes
  }
  console.log('[DONE] Architecture diagram complete!');
}

async function main() {
  await init();
  await draw();
  // Keep alive for a bit so user can see
  await sleep(2000);
  process.exit(0);
}

main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
