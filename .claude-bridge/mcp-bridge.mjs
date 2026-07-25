#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const MCP_CWD = '/Users/wangxingchao/github/drawio-scientific-illustrator/plugins/drawio-scientific-illustrator';
const child = spawn('node', ['scripts/live-server.mjs'], {
  cwd: MCP_CWD, stdio: ['pipe', 'pipe', 'pipe']
});

let buf = '', msgId = 0;
const pending = new Map();

const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  } catch(e) {}
});
child.stderr.on('data', d => process.stderr.write('[MCP-ERR] ' + d.toString()));

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 30000);
    pending.set(id, msg => { clearTimeout(t); resolve(msg); });
    const json = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    process.stderr.write(`[SEND] ${json.substring(0,120)}\n`);
    child.stdin.write(json + '\n');
  });
}

async function callTool(name, args = {}) {
  const result = await send('tools/call', { name, arguments: args });
  return result;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Init
  const initRes = await send('initialize', {
    protocolVersion: '2024-11-05', capabilities: {},
    clientInfo: { name: 'bridge', version: '1.0' }
  });
  process.stderr.write('[INIT] OK\n');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // Step 1: Launch draw.io
  process.stderr.write('[STEP] Launching draw.io...\n');
  const launchRes = await callTool('drawio_live_launch', { step_delay_ms: 500 });
  const launchText = launchRes.result?.content?.map(c => c.text || '').join('') || '';
  process.stderr.write('[LAUNCH] ' + launchText.substring(0, 200) + '\n');

  // Step 2: Check status
  const statusRes = await callTool('drawio_live_status', {});
  const statusText = statusRes.result?.content?.map(c => c.text || '').join('') || '';
  process.stderr.write('[STATUS] ' + statusText.substring(0, 200) + '\n');

  // Now read commands from the file passed as argument
  const { readFileSync } = await import('node:fs');
  const commands = JSON.parse(readFileSync(process.argv[2], 'utf-8'));

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (cmd.tool === 'drawio_live_fit' || cmd.tool === 'drawio_live_screenshot') {
      process.stderr.write(`[${i+1}/${commands.length}] ${cmd.tool}\n`);
    } else {
      process.stderr.write(`[${i+1}/${commands.length}] ${cmd.tool}: ${(cmd.args?.id || cmd.args?.label || '')}\n`);
    }
    const result = await callTool(cmd.tool, cmd.args);
    const text = result.result?.content?.map(c => c.text || '').join('') || '';
    if (text.includes('error') || text.includes('Error') || result.result?.isError) {
      process.stderr.write('  ⚠️ ' + text.substring(0, 300) + '\n');
    } else {
      process.stderr.write('  ✓\n');
    }
    await sleep(cmd.delay || 500);
  }

  process.stderr.write('[DONE] Architecture diagram complete!\n');
  await sleep(1000);
  child.kill();
  process.exit(0);
}

main().catch(e => {
  process.stderr.write('[FATAL] ' + e.message + '\n');
  child.kill();
  process.exit(1);
});
