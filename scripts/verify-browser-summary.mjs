import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createWebServer } from './serve-web.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = resolve('docs/test-runs', new Date().toISOString().replaceAll(':', '-') + '-review-summary');
await mkdir(out, { recursive: true });
const report = { startedAt: new Date().toISOString(), complete: false, checks: [], defects: [], launches: [], assets4173: [], scope: 'Headless Chrome; normal Browser.close only. No force termination, OS restart, visual review or simultaneous-write race proof.' };
const profile = await mkdtemp(join(tmpdir(), 'ai-secretary-summary-'));
report.profile = profile;
report.scriptSha256 = hash(await readFile(new URL(import.meta.url)));
const server = createWebServer();
const clients = [];
let active;
async function persist() { await writeFile(join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); }
async function until(fn, label, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return; await sleep(100); }
  throw new Error('Timeout: ' + label);
}
// Every transport and process wait is bounded; a timeout never authorizes killing a user Chrome.
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => {
    const timer = setTimeout(() => { ws.close(); rej(new Error('WebSocket open timeout')); }, 5000);
    ws.addEventListener('open', () => { clearTimeout(timer); res(); }, { once: true });
    ws.addEventListener('error', () => { clearTimeout(timer); rej(new Error('WebSocket open error')); }, { once: true });
  });
  let serial = 0;
  const pending = new Map();
  const c = {
    ws,
    call(method, params = {}) {
      return new Promise((res, rej) => {
        const id = ++serial;
        const timer = setTimeout(() => { pending.delete(id); rej(new Error('CDP timeout: ' + method)); }, 5000);
        pending.set(id, { res, rej, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    async eval(expression) {
      const r = await c.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
      return r.result.value;
    },
  };
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    // Dialog decisions apply only to this isolated test target.
    if (m.method === 'Page.javascriptDialogOpening') {
      report.dialogs ??= [];
      report.dialogs.push({ type: m.params.type, message: m.params.message });
      c.call('Page.handleJavaScriptDialog', { accept: m.params.type === 'confirm' ? c.confirmAccept !== false : true }).catch(() => {});
    }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id); clearTimeout(p.timer);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  });
  ws.addEventListener('close', () => {
    for (const p of pending.values()) { clearTimeout(p.timer); p.rej(new Error('CDP closed')); }
    pending.clear();
  });
  clients.push(c);
  return c;
}
const getJson = async url => {
  const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
};
async function launch() {
  // Chrome leaves this file behind; removing only our isolated profile's marker avoids stale endpoint reuse.
  await unlink(join(profile, 'DevToolsActivePort')).catch(e => { if (e.code !== 'ENOENT') throw e; });
  const args = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-sync', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'];
  const child = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args, { stdio: 'ignore' });
  const entry = { pid: child.pid, profile, origin: report.origin, args, exited: false };
  report.launches.push(entry);
  active = { child, entry };
  child.on('error', e => { entry.launchError = e.message; });
  child.on('exit', (code, signal) => { entry.exited = true; entry.exitCode = code; entry.signal = signal; });
  let port, endpoint;
  await until(async () => {
    if (entry.launchError || entry.exited) throw new Error(entry.launchError || 'Chrome exited at startup');
    try {
      [port] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
      endpoint = await getJson('http://127.0.0.1:' + port + '/json/version');
      return !!endpoint.webSocketDebuggerUrl;
    } catch { return false; }
  }, 'Chrome startup', 15000);
  active.port = port;
  active.browser = await connect(endpoint.webSocketDebuggerUrl);
  return active;
}
async function closeChrome() {
  const a = active;
  if (!a || a.entry.exited) return;
  a.entry.closeRequestedAt = new Date().toISOString();
  try { await a.browser.call('Browser.close'); a.entry.closeReply = 'acknowledged'; }
  catch (e) { a.entry.closeReply = e.message; }
  await until(() => a.entry.exited, 'test Chrome process exit', 10000);
  try { process.kill(a.child.pid, 0); a.entry.pidAbsent = false; }
  catch (e) { a.entry.pidAbsent = e.code === 'ESRCH'; }
  assert.equal(a.entry.exitCode, 0);
  assert.equal(a.entry.signal, null);
  assert.equal(a.entry.pidAbsent, true);
  active = undefined;
}
async function page() {
  const { targetId } = await active.browser.call('Target.createTarget', { url: 'about:blank' });
  const list = await getJson('http://127.0.0.1:' + active.port + '/json/list');
  const c = await connect(list.find(p => p.id === targetId).webSocketDebuggerUrl);
  await c.call('Page.enable');
  await c.call('Page.navigate', { url: report.origin });
  await ready(c);
  return c;
}
async function ready(c) {
  await until(() => c.eval("!window.__oldPersistenceDocument && document.readyState==='complete' && document.querySelectorAll('.task').length===2"), 'new document render');
}
async function reload(c) {
  await c.eval('window.__oldPersistenceDocument=true');
  await c.call('Page.reload');
  await ready(c);
}
const ids = ['title', 'summary', 'discussion', 'decisions', 'unresolved', ...[0, 1].flatMap(i => ['title', 'assignee', 'due'].map(k => 'task-' + i + '-' + k))];
async function snapshot(c) {
  return c.eval(`({ fields:Object.fromEntries(${JSON.stringify(ids)}.map(id=>[id,document.getElementById(id).value])), reviewed:document.getElementById('reviewed').checked, disabled:document.getElementById('save').disabled, state:document.getElementById('state').textContent, savedAt:document.getElementById('saved-at').textContent, message:document.getElementById('message').textContent, raw:localStorage.getItem('ai-secretary:desktop-demo:v1') })`);
}
async function edit(c, values) {
  await c.eval(`for(const [id,value] of Object.entries(${JSON.stringify(values)})){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}`);
}
async function save(c) {
  await c.eval("if(!document.getElementById('reviewed').checked)document.getElementById('reviewed').click();document.getElementById('save').click()");
  return snapshot(c);
}
function check(name, passed, evidence) {
  report.checks.push({ name, passed, evidence });
  console.log((passed ? 'PASS ' : 'FAIL ') + name);
  assert.ok(passed, name);
}
async function overview(c) {
  return c.eval(`({
    counts:['task-total','task-missing-assignee','task-missing-due','task-needs-check'].map(id=>document.getElementById(id).textContent),
    state:document.getElementById('overview-state').textContent,
    expected:document.getElementById('state').textContent+' — '+document.getElementById('save-guidance').textContent,
    items:document.getElementById('task-summary-list').textContent
  })`);
}
async function expect(c, name, counts, pattern) {
  const s = await overview(c);
  check(name, JSON.stringify(s.counts) === JSON.stringify(counts.map(n=>n+'건')) && s.state === s.expected && pattern.test(s.state), s);
}
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  report.origin = 'http://127.0.0.1:' + server.address().port;
  await launch();
  const a = await page();
  await expect(a, 'Initial counts are candidates, not completed tasks', [2,1,1,1], /검토 대기/);
  check('Explicit non-completion disclaimer', await a.eval("document.querySelector('.review-overview').textContent.includes('업무 수행 완료를 뜻하지 않습니다')"));
  await edit(a, {'task-0-assignee':'  ', 'task-0-due':'', 'task-1-title':'   '});
  await expect(a, 'Whitespace and missing fields count once per task from unsaved input', [2,2,2,2], /재검토 필요/);
  check('Empty title fallback and no implicit save', (await overview(a)).items.includes('제목 미입력') && (await snapshot(a)).raw === null);
  await edit(a, {'task-0-assignee':'준호', 'task-0-due':'2026-10-09', 'task-1-title':'<img src=x onerror=alert(1)>', 'task-1-assignee':'서연', 'task-1-due':'2026-10-12'});
  await expect(a, 'Filled fields still require content review', [2,0,0,0], /재검토 필요/);
  check('User title rendered as text, never markup', await a.eval("document.querySelectorAll('#task-summary-list img').length===0 && document.getElementById('task-summary-list').textContent.includes('<img')"));
  for (const target of ['task-0-title','task-1-title','reviewed']) {
    await a.eval(`document.querySelector('[data-edit-target="${target}"]').focus()`);
    await a.call('Input.dispatchKeyEvent', {type:'keyDown',text:'\r',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await a.call('Input.dispatchKeyEvent', {type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    check('Keyboard shortcut focuses '+target, await a.eval('document.activeElement.id') === target);
  }
  await a.eval("document.getElementById('reviewed').click()");
  await expect(a, 'Review is explicitly not saved', [2,0,0,0], /검토 완료 · 저장 전/);
  await save(a);
  await expect(a, 'Saved state matches source of truth', [2,0,0,0], /저장된 확정본/);
  const raw = (await snapshot(a)).raw;
  await reload(a);
  await expect(a, 'Reload restores summary from saved values', [2,0,0,0], /저장된 확정본/);
  check('Summary does not alter serialized storage contract', (await snapshot(a)).raw === raw && !raw.includes('task-total'));
  const b = await page();
  await edit(b, {'task-1-assignee':'', 'task-1-due':''});
  await save(b);
  await until(async()=> (await overview(a)).counts[1]==='1건','other tab summary');
  await expect(a, 'Clean tab summary follows real storage event', [2,1,1,1], /저장된 확정본/);
  await edit(a, {'task-0-assignee':''});
  await edit(b, {'task-1-assignee':'서연', 'task-1-due':'2026-10-12'});
  await save(b);
  await until(async()=> (await overview(a)).state.includes('저장 차단'),'dirty tab protection');
  await expect(a, 'Blocked dirty tab summarizes its retained input, not external data', [2,2,1,2], /저장 차단/);
  await a.eval("document.getElementById('load-latest').click()");
  await expect(a, 'Explicit latest restore refreshes counts', [2,0,0,0], /저장된 확정본/);
  await a.eval("window.originalSet=Storage.prototype.setItem; Storage.prototype.setItem=()=>{throw new Error('summary quota')}");
  await save(a);
  await expect(a, 'Save failure cannot show saved success', [2,0,0,0], /저장 실패 · 미저장/);
  await a.eval("Storage.prototype.setItem=window.originalSet;document.getElementById('save').click()");
  await expect(a, 'Retry recovers consistent state', [2,0,0,0], /저장된 확정본/);
  await edit(a, {'task-0-title':'', 'task-1-title':''});
  await expect(a, 'All empty titles keep candidate total and flag both', [2,0,0,2], /재검토 필요/);
  await reload(a);
  await a.eval("localStorage.setItem('ai-secretary:desktop-demo:v1','{bad');document.getElementById('load-latest').click()");
  await expect(a, 'Corrupt storage block overrides summary success', [2,0,0,0], /저장 차단/);
  await closeChrome();
  report.complete = true;
} catch (error) {
  report.defects.push(error.stack);
  process.exitCode = 1;
} finally {
  if (active) { try { await closeChrome(); } catch(error) { report.defects.push(error.stack); active?.child.kill('SIGTERM'); process.exitCode = 1; } }
  for (const c of clients) c.ws.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await persist();
  console.log(JSON.stringify({out,complete:report.complete,passed:report.checks.filter(c=>c.passed).length,defects:report.defects},null,2));
}
