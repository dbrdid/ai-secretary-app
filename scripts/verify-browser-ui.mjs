import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWebServer } from './serve-web.mjs';

// 별도 프로필과 임시 포트로 실제 사용자 저장본과 실행 중인 서버를 건드리지 않는다.
const profile = await mkdtemp(join(tmpdir(), 'ai-secretary-ui-'));
const server = createWebServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
  '--disable-sync', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
  '--user-data-dir=' + profile, 'about:blank',
], { stdio: 'ignore' });
let launchError;
chrome.on('error', error => { launchError = error; });
let ws;
const pending = new Map();
let serial = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  for (let i = 0; i < 150; i++) { if (await fn()) return; await sleep(100); }
  throw new Error('Timeout: ' + label);
}
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 10000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function ready() {
  await until(() => evaluate("!window.__verificationOldDocument && document.readyState === 'complete' && document.querySelectorAll('.task').length === 2 && document.querySelectorAll('.utterance').length === 4"), 'app render');
}
const checks = [];
function pass(name) { checks.push(name); console.log('PASS ' + name); }
try {
  let port;
  await until(async () => {
    if (launchError) throw launchError;
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; return !!port; } catch { return false; }
  }, 'Chrome startup');
  const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id); clearTimeout(waiter.timer);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error))); else waiter.resolve(message.result);
  });
  await call('Page.enable');
  await call('Page.navigate', { url: base });
  await ready();

  const out = 'docs/test-runs/' + new Date().toISOString().replaceAll(':','-') + '-workspace-ui';
  await mkdir(out, { recursive: true });
  await call('Emulation.setEmulatedMedia', { features: [{name:'prefers-reduced-motion',value:'reduce'}] });
  assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);
  assert.match(await evaluate("document.getElementById('save-guidance').textContent"), /아직 저장 전/);
  pass('Initial unsaved guidance and reduced-motion preference');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('input,textarea')].filter(e=>!e.labels?.length).map(e=>e.id)"), []);
  assert.equal(await evaluate("document.getElementById('save').getAttribute('aria-describedby')"), 'save-guidance');
  assert.equal(await evaluate("document.getElementById('save-guidance').getAttribute('role')"), 'status');
  pass('All editable controls labeled; save guidance associated and live');
  await call('Input.dispatchKeyEvent', { type:'keyDown', key:'Tab', code:'Tab', windowsVirtualKeyCode:9 });
  await call('Input.dispatchKeyEvent', { type:'keyUp', key:'Tab', code:'Tab', windowsVirtualKeyCode:9 });
  assert.equal(await evaluate("document.activeElement.className"), 'skip-link');
  assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle"), 'solid');
  // CDP must include the Enter character to reproduce native button activation.
  await call('Input.dispatchKeyEvent', { type:'keyDown', text:'\r', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
  await call('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
  assert.equal(await evaluate("document.activeElement.id"), 'review-form');
  await call('Input.dispatchKeyEvent', { type:'keyDown', key:'Tab', code:'Tab', windowsVirtualKeyCode:9 });
  await call('Input.dispatchKeyEvent', { type:'keyUp', key:'Tab', code:'Tab', windowsVirtualKeyCode:9 });
  assert.equal(await evaluate("document.activeElement.id"), 'title');
  pass('Real Tab / Enter skip-link -> form -> first field and visible focus');
  await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  await evaluate("document.querySelector('[data-evidence=s2]').focus()");
  assert.equal(await evaluate("document.activeElement.dataset.evidence"), 's2');
  // CDP must include the Enter character to reproduce native button activation.
  await call('Input.dispatchKeyEvent', { type:'keyDown', text:'\r', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
  await call('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
  assert.equal(await evaluate("document.activeElement.id"), 's2');
  pass('Keyboard evidence activation moves focus to transcript');
  for (const width of [1440, 390]) {
    await call('Emulation.setDeviceMetricsOverride', {width,height:1000,deviceScaleFactor:1,mobile:false});
    await evaluate("window.scrollTo(0,0)");
    const shot = await call('Page.captureScreenshot', {format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:await evaluate("document.documentElement.scrollHeight"),scale:1}});
    await writeFile(out+'/'+width+'-full.png',Buffer.from(shot.data,'base64'));
  }
  const layouts = [];
  for (const width of [1440, 1024, 768, 600, 390, 320]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height:900, deviceScaleFactor:1, mobile:false });
    // Long unbroken display text and user values exercise intrinsic sizing, not only the short fixture.
    await evaluate("document.querySelector('#s1 p').textContent='긴원문'.repeat(150); document.getElementById('title').value='긴제목'.repeat(100)");
    const dimensions = await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('input,textarea,button')].filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1}).map(e=>e.id||e.textContent)})");
    assert.ok(dimensions.scroll <= width + 1, JSON.stringify(dimensions));
    assert.deepEqual(dimensions.controls, []);
    layouts.push(dimensions);
    const shot = await call('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
    await writeFile(out + '/' + width + '.png', Buffer.from(shot.data,'base64'));
    pass('No horizontal overflow or clipped controls at ' + width + 'px');
  }
  await evaluate("document.getElementById('title').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.getElementById('state').dataset.tone"), 'dirty');
  assert.match(await evaluate("document.getElementById('save-guidance').textContent"), /미저장 변경/);
  await evaluate("document.getElementById('reviewed').click()");
  assert.equal(await evaluate("document.getElementById('state').dataset.tone"), 'ready');
  assert.match(await evaluate("document.getElementById('state').textContent"), /저장 전/);
  await evaluate("document.getElementById('save').click()");
  assert.equal(await evaluate("document.getElementById('state').dataset.tone"), 'saved');
  assert.match(await evaluate("document.getElementById('save-guidance').textContent"), /저장된 확정본/);
  assert.equal(await evaluate("document.getElementById('reviewed').checked"), false);
  pass('Dirty -> reviewed but unsaved -> saved guidance and review reset');
  await evaluate("window.originalSetItem=Storage.prototype.setItem; Storage.prototype.setItem=()=>{throw new Error('UI test quota')}; document.getElementById('reviewed').click(); document.getElementById('save').click()");
  assert.equal(await evaluate("document.getElementById('state').dataset.tone"), 'error');
  assert.match(await evaluate("document.getElementById('state').textContent"), /저장 실패/);
  assert.match(await evaluate("document.getElementById('save-guidance').textContent"), /저장하지 못했습니다/);
  await evaluate("Storage.prototype.setItem=window.originalSetItem; document.getElementById('save').click()");
  assert.equal(await evaluate("document.getElementById('state').dataset.tone"), 'saved');
  pass('Failed save is not reported saved; retry recovers');
  await evaluate("localStorage.setItem('ai-secretary:desktop-demo:v1','{bad'); document.getElementById('load-latest').click()");
  assert.equal(await evaluate("document.getElementById('state').dataset.tone"), 'error');
  assert.match(await evaluate("document.getElementById('state').textContent"), /차단/);
  assert.equal(await evaluate("document.getElementById('save').disabled"), true);
  pass('Storage block overrides saved badge and disables save');
  const report = {passed:checks.length,checks,profile,origin:base,layouts,scope:'Isolated headless Chrome; screenshots and DOM geometry, keyboard subset. Not screen-reader or real mobile certification.'};
  await writeFile(out+'/result.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({out,...report},null,2));

} finally {
  if (ws) ws.close();
  chrome.kill('SIGTERM');
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  for (const waiter of pending.values()) clearTimeout(waiter.timer);
}
