import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createWebServer } from './serve-web.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = resolve('docs/test-runs', new Date().toISOString().replaceAll(':', '-') + '-browser-persistence');
await mkdir(out, { recursive: true });
const report = { startedAt: new Date().toISOString(), complete: false, checks: [], defects: [], launches: [], assets4173: [], scope: 'Headless Chrome; normal Browser.close only. No force termination, OS restart, visual review or simultaneous-write race proof.' };
const profile = await mkdtemp(join(tmpdir(), 'ai-secretary-persistence-'));
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
}
function equivalent(a, b) {
  return JSON.stringify(a.fields) === JSON.stringify(b.fields) && a.raw === b.raw && a.state === b.state && a.reviewed === b.reviewed && a.disabled === b.disabled && a.savedAt === b.savedAt;
}
async function changed(c) {
  await until(() => c.eval("document.getElementById('message').textContent.includes('다른 탭')"), 'cross-tab storage notification', 3000).catch(e => { report.notificationWaits ??= []; report.notificationWaits.push(e.message); });
}
async function collision(writer, stale, label, field, value) {
  const baseline = await snapshot(stale);
  await edit(stale, { summary: label + ' stale unsaved summary' });
  await edit(writer, { [field]: value });
  const saved = await save(writer);
  assert.match(saved.message, /확정본을 이 브라우저에 저장/);
  await changed(stale);
  const beforeAttempt = await snapshot(stale);
  const afterAttempt = await save(stale);
  const writerAfter = await snapshot(writer);
  const protectedSave = beforeAttempt.disabled && /다른 탭/.test(beforeAttempt.message) && afterAttempt.raw === saved.raw && writerAfter.raw === saved.raw;
  check(label + ': stale-tab warning and overwrite protection', protectedSave, { baseline, saved, beforeAttempt, afterAttempt, writerAfter });
  check(label + ': dirty fields and review preserved (no automatic merge)',
    beforeAttempt.fields.summary === label + ' stale unsaved summary' &&
    beforeAttempt.fields[field] === baseline.fields[field] && !beforeAttempt.reviewed,
    { baseline, beforeAttempt });
  if (!protectedSave) report.defects.push(label + ': 오래된 탭 저장 차단 실패 또는 경고 누락.');
  const cancelBaseline = await snapshot(stale);
  stale.confirmAccept = false;
  const dialogCount = report.dialogs?.length ?? 0;
  await stale.eval("document.getElementById('load-latest').click()");
  const cancelled = await snapshot(stale);
  check(label + ': confirm cancel preserves fields/review/lock',
    equivalent(cancelBaseline, cancelled) && cancelled.message === cancelBaseline.message &&
    report.dialogs.length === dialogCount + 1 && report.dialogs.at(-1).type === 'confirm', { cancelled });
  stale.confirmAccept = true;
  await stale.eval("document.getElementById('load-latest').click()");
  const loaded = await snapshot(stale);
  check(label + ': confirm accept loads latest and resets review', equivalent(saved, loaded), { saved, loaded });
  await reload(stale);
  const restored = await snapshot(stale);
  check(label + ': reload reflects saved changes', equivalent(saved, restored), { saved, restored });

}
const key = 'ai-secretary:desktop-demo:v1';
async function eventNow(c, options = '') {
  await c.eval(`window.dispatchEvent(new StorageEvent('storage',{key:${JSON.stringify(key)},storageArea:localStorage,${options}}))`);
}
async function cleanSync(writer, reader, label, values) {
  await edit(writer, values);
  const saved = await save(writer);
  await until(async () => equivalent(saved, await snapshot(reader)), label);
  const received = await snapshot(reader);
  check(label, /자동 반영/.test(received.message), { saved, received });
}
async function edgeCases(writer, reader) {
  // Review-only edits are deliberately protected even when no text was edited.
  await reader.eval("document.getElementById('reviewed').click()");
  const reviewed = await snapshot(reader);
  await edit(writer, { summary: 'review-only remote change' });
  const saved = await save(writer);
  await until(async () => (await snapshot(reader)).disabled, 'review-only lock');
  const held = await snapshot(reader);
  check('Review-only local change protected', held.reviewed && JSON.stringify(held.fields) === JSON.stringify(reviewed.fields) && held.raw === saved.raw, { reviewed, held });
  reader.confirmAccept = true;
  await reader.eval("document.getElementById('load-latest').click()");
  check('Review-only explicit load resets checkbox', equivalent(saved, await snapshot(reader)), await snapshot(reader));

  const beforeIgnored = await snapshot(reader);
  await reader.eval(`window.dispatchEvent(new StorageEvent('storage',{key:'unrelated',storageArea:localStorage}));
    window.dispatchEvent(new StorageEvent('storage',{key:${JSON.stringify(key)},storageArea:sessionStorage}));
    window.dispatchEvent(new StorageEvent('storage',{key:${JSON.stringify(key)}}));`);
  const afterIgnored = await snapshot(reader);
  check('Other keys/sessionStorage/null storageArea ignored', JSON.stringify(beforeIgnored) === JSON.stringify(afterIgnored), { afterIgnored });

  // Instrument only the isolated page: receiving events must never write.
  await reader.eval("window.__writes=0;window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(...args){window.__writes++;return window.__set.apply(this,args)}");
  await eventNow(reader, "newValue:'{bad',oldValue:null");
  check('Delayed payload ignored in favor of current raw; no storage write', equivalent(saved, await snapshot(reader)) && await reader.eval('window.__writes===0'), await snapshot(reader));

  for (const kind of ['delete', 'clear', 'corrupt', 'invalid-schema', 'read-error']) {
    const baseline = await snapshot(reader);
    if (kind === 'read-error') {
      await reader.eval("window.__get=Storage.prototype.getItem;Storage.prototype.getItem=function(){throw new Error('injected read failure')}");
      await eventNow(reader);
      await reader.eval("Storage.prototype.getItem=window.__get");
    } else {
      await writer.eval(kind === 'delete' ? `localStorage.removeItem(${JSON.stringify(key)})` :
        kind === 'clear' ? 'localStorage.clear()' :
        `localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(kind === 'corrupt' ? '{bad' : '{}')})`);
      await until(async () => /차단/.test((await snapshot(reader)).message), kind + ' warning');
    }
    const broken = await snapshot(reader);
    check(kind + ': existing input preserved and saving blocked', broken.disabled && JSON.stringify(broken.fields) === JSON.stringify(baseline.fields) && broken.reviewed === baseline.reviewed && /차단/.test(broken.message), { broken });
    await writer.eval(`localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(saved.raw)})`);
    if (kind === 'read-error') await eventNow(reader);
    await until(async () => /자동 반영/.test((await snapshot(reader)).message), kind + ' recovered');
    check(kind + ': clean tab recovers valid snapshot', equivalent(saved, await snapshot(reader)), await snapshot(reader));
  }
  check('All storage receive paths are write-free', await reader.eval('window.__writes===0'), { writes: await reader.eval('window.__writes') });
  await reader.eval('Storage.prototype.setItem=window.__set');

  // A recovered store must not silently discard protected edits or review changes.
  for (const kind of ['delete', 'clear', 'corrupt', 'read-error']) {
    await edit(reader, { summary: 'protected through ' + kind });
    await reader.eval("document.getElementById('reviewed').click()");
    const local = await snapshot(reader);
    if (kind === 'read-error') {
      await reader.eval("window.__get=Storage.prototype.getItem;Storage.prototype.getItem=function(){throw new Error('injected dirty read failure')}");
      await eventNow(reader);
      await reader.eval("Storage.prototype.getItem=window.__get");
    } else {
      await writer.eval(kind === 'delete' ? `localStorage.removeItem(${JSON.stringify(key)})` :
        kind === 'clear' ? 'localStorage.clear()' : `localStorage.setItem(${JSON.stringify(key)},'{bad')`);
      await until(async () => (await snapshot(reader)).disabled, 'dirty error lock');
    }
    const broken = await snapshot(reader);
    await writer.eval(`localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(saved.raw)})`);
    await eventNow(reader);
    const recovered = await snapshot(reader);
    check(kind + ': dirty input/review survive error and valid recovery with lock',
      [broken, recovered].every(x => x.disabled && x.reviewed && JSON.stringify(x.fields) === JSON.stringify(local.fields)),
      { local, broken, recovered });
    reader.confirmAccept = false;
    await reader.eval("document.getElementById('load-latest').click()");
    check(kind + ': dirty recovery cancel preserves state', equivalent(recovered, await snapshot(reader)), await snapshot(reader));
    reader.confirmAccept = true;
    await reader.eval("document.getElementById('load-latest').click()");
    check(kind + ': dirty recovery accept restores saved state', equivalent(saved, await snapshot(reader)), await snapshot(reader));
  }

  // Valid draft status and absent timestamp are applied, not just confirmed snapshots.
  const validDraft = { ...JSON.parse(saved.raw), status: 'draft', savedAt: null };
  await writer.eval(`localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(JSON.stringify(validDraft))})`);
  await until(async () => (await snapshot(reader)).state === '검토 대기', 'draft status sync');
  const draftState = await snapshot(reader);
  check('Valid draft status and null savedAt reflected', draftState.savedAt === '아직 저장하지 않았습니다.' && !draftState.reviewed && JSON.stringify(draftState.fields) === JSON.stringify(saved.fields), { draftState });
  await writer.eval(`localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(saved.raw)})`);
  await until(async () => equivalent(saved, await snapshot(reader)), 'confirmed restore');

  // Same-document mutation creates a changed raw without delivering a storage event.
  // It deterministically exercises the save guard without pretending to prove atomicity.
  const baseline = await snapshot(reader);
  const newer = { ...JSON.parse(baseline.raw), title: 'delayed event latest', savedAt: '2026-10-08T10:11:12.000Z' };
  await edit(reader, { title: 'stale delayed overwrite' });
  await reader.eval(`localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(JSON.stringify(newer))})`);
  const attempted = await save(reader);
  check('Pre-save raw guard blocks delayed-event overwrite', attempted.raw === JSON.stringify(newer) && attempted.fields.title === 'stale delayed overwrite' && attempted.reviewed && attempted.disabled && /차단/.test(attempted.message), { attempted });
  await reader.eval("document.getElementById('load-latest').click()");
  await until(async () => equivalent(await snapshot(reader), await snapshot(writer)), 'writer catches delayed mutation');
  await eventNow(reader, `newValue:${JSON.stringify(saved.raw)}`);
  check('Late older payload cannot roll back current UI', (await snapshot(reader)).fields.title === newer.title && (await snapshot(reader)).raw === JSON.stringify(newer), await snapshot(reader));
}
const watchdog = setTimeout(() => {
  report.error = 'Global 90-second deadline exceeded; test Chrome not forcibly terminated.';
  report.complete = false;
  writeFile(join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n').finally(() => process.exit(2));
}, 90000);
try {
  await new Promise((res, rej) => { server.once('error', rej); server.listen(0, '127.0.0.1', res); });
  report.origin = 'http://127.0.0.1:' + server.address().port;
  for (const [url, file] of [['/', 'index.html'], ['/app.mjs', 'app.mjs'], ['/model.mjs', 'model.mjs'], ['/style.css', 'style.css']]) {
    const local = await readFile(new URL('../web/' + file, import.meta.url));
    try {
      const r = await fetch('http://127.0.0.1:4173' + url, { signal: AbortSignal.timeout(2000) });
      const remote = Buffer.from(await r.arrayBuffer());
      report.assets4173.push({ url, status: r.status, localSha256: hash(local), servedSha256: hash(remote), equal: r.ok && remote.equals(local) });
    } catch (e) { report.assets4173.push({ url, error: e.message, localSha256: hash(local) }); }
  }
  await launch();
  const a = await page();
  await edit(a, { title: 'persistence-A title', summary: 'persistence-A summary', discussion: 'persistence-A discussion', decisions: 'persistence-A decisions', unresolved: 'persistence-A unresolved', 'task-0-title': 'A task 0', 'task-0-assignee': '검증 담당 A', 'task-0-due': '2026-10-12', 'task-1-title': 'A task 1', 'task-1-assignee': '검증 담당 B', 'task-1-due': '2026-10-13' });
  const initial = await save(a);
  assert.match(initial.message, /확정본을 이 브라우저에 저장/);
  const b = await page();
  const restoredB = await snapshot(b);
  check('A UI save -> B new-tab restore (11 fields and review state)', equivalent(initial, restoredB), { initial, restoredB });
  await cleanSync(a, b, 'A -> B clean automatic sync (11 fields/status/savedAt/review)', {
    title:'auto A', summary:'auto summary', discussion:'auto discussion', decisions:'auto decision', unresolved:'auto unresolved',
    'task-0-title':'auto task 0','task-0-assignee':'A','task-0-due':'2026-10-14',
    'task-1-title':'auto task 1','task-1-assignee':'B','task-1-due':'2026-10-15'
  });
  await cleanSync(b, a, 'B -> A clean automatic sync', { title:'auto B', 'task-1-assignee':'C' });
  await collision(a, b, 'A -> B', 'title', 'A latest title');
  await collision(b, a, 'B -> A', 'discussion', 'B latest discussion');
  await edgeCases(a, b);
  const expected = await snapshot(a);
  assert.equal(JSON.parse(expected.raw).status, 'confirmed');
  report.savedBaseline = expected;
  await closeChrome();
  check('First Chrome normal exit verified before relaunch', true, report.launches[0]);
  await launch();
  const c = await page();
  const afterRestart = await snapshot(c);
  check('Same profile/origin full Chrome restart restores saved fields and review state', equivalent(expected, afterRestart), { expected, afterRestart });
  await edit(c, { title: 'UNSAVED MUST NOT SURVIVE', 'task-0-title': 'UNSAVED TASK' });
  await c.eval("document.getElementById('reviewed').click()");
  report.unsavedBeforeClose = await snapshot(c);
  await closeChrome();
  await launch();
  const d = await page();
  const unsavedRestart = await snapshot(d);
  check('Unsaved edits and review checkbox discarded; previous confirmed save preserved', equivalent(expected, unsavedRestart), { beforeClose: report.unsavedBeforeClose, restored: unsavedRestart });
  await closeChrome();
  check('All three isolated Chrome PIDs normally exited and absent', report.launches.length === 3 && report.launches.every(x => x.exited && x.exitCode === 0 && x.pidAbsent), report.launches);
  report.complete = true;
} catch (e) {
  report.error = e.stack;
  console.error(e.stack);
} finally {
  if (active && !active.entry.exited) {
    try { await closeChrome(); } catch (e) { report.cleanupError = e.stack; active.child.unref(); }
  }
  for (const c of clients) c.ws.close();
  server.closeAllConnections();
  if (server.listening) await new Promise(r => server.close(r));
  clearTimeout(watchdog);
  report.finishedAt = new Date().toISOString();
  report.exitCode = !report.complete || report.cleanupError ? 2 : report.checks.some(c => !c.passed) ? 1 : 0;
  await persist();
  console.log(JSON.stringify({ result: join(out, 'result.json'), resultSha256: hash(await readFile(join(out, 'result.json'))), exitCode: report.exitCode, profile, origin: report.origin }));
  process.exitCode = report.exitCode;
}
