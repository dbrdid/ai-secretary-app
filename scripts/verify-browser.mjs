import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWebServer } from './serve-web.mjs';

// 별도 프로필과 임시 포트로 실제 사용자 저장본과 실행 중인 서버를 건드리지 않는다.
const profile = await mkdtemp(join(tmpdir(), 'ai-secretary-browser-'));
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
  assert.equal(await evaluate("document.querySelector('.demo').textContent"), '예시 모드');
  assert.equal(await evaluate("document.querySelector('#save').disabled"), true);
  pass('실제 Chrome에서 초기 렌더링·예시 표시·검토 전 저장 잠금');
  await evaluate("document.querySelector('[data-evidence=s2]').click()");
  assert.equal(await evaluate("document.activeElement.id"), 's2');
  assert.equal(await evaluate("document.querySelector('#s2').classList.contains('selected')"), true);
  pass('근거 클릭 후 원문 강조·초점 이동');
  await evaluate("document.querySelector('#reviewed').focus()");
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  assert.equal(await evaluate("document.querySelector('#reviewed').checked"), true);
  pass('키보드 Space 검토 체크');
  await evaluate("document.querySelector('#summary').value='브라우저 검증 수정본'; document.querySelector('#summary').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#reviewed').checked"), false);
  assert.equal(await evaluate("document.querySelector('#save').disabled"), true);
  pass('편집 후 검토 해제·저장 잠금');
  await evaluate("document.querySelector('#reviewed').click(); document.querySelector('#save').click()");
  assert.match(await evaluate("document.querySelector('#message').textContent"), /확정본을 이 브라우저에 저장/);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('ai-secretary:desktop-demo:v1')).summary"), '브라우저 검증 수정본');
  // 이전 DOM도 요소 수 조건을 만족하므로 새 문서로 교체된 뒤에만 복원을 검사한다.
  await evaluate('window.__verificationOldDocument = true');
  await call('Page.reload');
  await ready();
  assert.equal(await evaluate("document.querySelector('#summary').value"), '브라우저 검증 수정본');
  assert.match(await evaluate("document.querySelector('#message').textContent"), /복원/);
  assert.equal(await evaluate("document.querySelector('#task-1-assignee').value"), '');
  assert.equal(await evaluate("document.querySelector('#task-1-due').value"), '');
  pass('실제 localStorage 저장·새로고침 복원·미지정 담당자/기한 유지');
  await evaluate("document.querySelector('#reviewed').click(); document.querySelector('#save').click()");
  assert.equal(await evaluate("localStorage.length"), 1);
  pass('반복 저장 시 저장 키 중복 없음');
  // 용량을 실제로 소진하지 않고 브라우저의 저장 예외 경로만 검증한다.
  await evaluate("window.originalSetItem=Storage.prototype.setItem; Storage.prototype.setItem=function(){throw new DOMException('검증용 저장 실패','QuotaExceededError')}; document.querySelector('#summary').value='실패 후 입력 유지'; document.querySelector('#summary').dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#reviewed').click(); document.querySelector('#save').click()");
  assert.match(await evaluate("document.querySelector('#message').textContent"), /저장하지 못했습니다/);
  assert.equal(await evaluate("document.querySelector('#summary').value"), '실패 후 입력 유지');
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('ai-secretary:desktop-demo:v1')).summary"), '브라우저 검증 수정본');
  pass('주입한 저장 예외: 오류 안내·입력 유지·이전 저장본 보존');
  await evaluate("Storage.prototype.setItem=window.originalSetItem; localStorage.setItem('ai-secretary:desktop-demo:v1','{bad'); document.querySelector('#reviewed').click()");
  // 미저장 변경 경고 때문에 자동화가 멈추지 않게 테스트 탭을 새 문서로 연다.
  await call('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
  await evaluate('window.__verificationOldDocument = true');
  await call('Page.navigate', { url: 'about:blank' });
  await call('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
  await call('Page.navigate', { url: base });
  await ready();
  assert.match(await evaluate("document.querySelector('#message').textContent"), /저장소를 읽지 못했습니다/);
  await evaluate("document.querySelector('#reviewed').click()");
  assert.equal(await evaluate("document.querySelector('#save').disabled"), true);
  assert.equal(await evaluate("localStorage.getItem('ai-secretary:desktop-demo:v1')"), '{bad');
  pass('손상 저장본 읽기 실패·덮어쓰기 잠금');
  console.log(JSON.stringify({ passed: checks.length, checks, profile, scope: 'Headless Chrome DOM·키보드 일부 검증. 시각 품질·전체 Tab 순서·실제 용량 소진·다중 탭은 별도 검증.' }, null, 2));
} finally {
  if (ws) ws.close();
  chrome.kill('SIGTERM');
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  for (const waiter of pending.values()) clearTimeout(waiter.timer);
}
