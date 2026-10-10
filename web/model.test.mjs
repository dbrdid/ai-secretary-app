import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDraft, validateDraft, saveDraft, loadDraft, STORAGE_KEY } from './model.mjs';
import { createWebServer } from '../scripts/serve-web.mjs';
function memory() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
test('예시는 실제 AI 결과와 구분되고 담당자·기한 누락을 유지한다', () => {
  const draft = createDraft();
  assert.equal(validateDraft(draft), true);
  assert.equal(draft.mode, 'example');
  assert.equal(draft.tasks[1].assignee, '');
  assert.equal(draft.tasks[1].due, '');
});
test('검토 없이 확정 저장하지 않는다', () => {
  const storage = memory();
  assert.throws(() => saveDraft(storage, createDraft(), false));
  assert.equal(storage.data.size, 0);
});
test('수정된 확정본 복원 및 반복 저장 중복 방지', () => {
  const storage = memory(), draft = createDraft();
  draft.summary = '사용자가 고친 요약';
  const saved = saveDraft(storage, draft, true);
  assert.deepEqual(loadDraft(storage), saved);
  assert.equal(saved.status, 'confirmed');
  saveDraft(storage, draft, true);
  assert.equal(storage.data.size, 1);
});
test('빈 저장소는 빈 결과', () => assert.equal(loadDraft(memory()), null));
test('손상 데이터는 보존하고 오류로 처리한다', () => {
  for (const raw of ['{bad', '{}', 'null', JSON.stringify({...createDraft(), mode: 'ai'})]) {
    const storage = memory(); storage.setItem(STORAGE_KEY, raw);
    assert.throws(() => loadDraft(storage));
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});
test('저장 용량·권한 실패를 성공으로 바꾸지 않는다', () => {
  assert.throws(() => saveDraft({setItem() { throw new Error('quota'); }}, createDraft(), true), /quota/);
});
test('필수 제목과 불가능한 날짜 및 손상 근거를 거른다', () => {
  const empty = createDraft(); empty.title = ' ';
  assert.equal(validateDraft(empty), false);
  const invalid = createDraft(); invalid.tasks[0].due = '2026-02-30';
  assert.equal(validateDraft(invalid), false);
  const broken = createDraft(); broken.tasks[0].evidenceId = 'missing';
  assert.equal(validateDraft(broken), false);
  assert.throws(() => saveDraft(memory(), createDraft(), true, 'not-a-date'));
});
test('로컬 서버는 웹 자산만 제공하고 프로젝트 파일 노출을 막는다', async () => {
  const server = createWebServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const path of ['/', '/app.mjs', '/model.mjs', '/style.css']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-security-policy'));
      assert.ok((await response.text()).length > 0);
    }
    for (const path of ['/package.json', '/.env', '/src/contracts/items.ts', '/%2e%2e/AGENTS.md']) {
      assert.equal((await fetch(base + path)).status, 404);
    }
    assert.equal((await fetch(base, {method:'POST'})).status, 405);
    assert.equal(await (await fetch(base, {method:'HEAD'})).text(), '');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
