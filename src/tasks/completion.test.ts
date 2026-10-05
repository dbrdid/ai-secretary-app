import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryItemStore } from '../adapters/fake/memoryItemStore.ts';
import { showsAiBadge, type Item, type TaskContent, type TaskItem } from '../contracts/items.ts';
import type { StoreResult } from '../contracts/itemStore.ts';
import { createCompletionToggle, withCompletion } from './completion.ts';

const NOW = '2026-10-05T03:00:00.000Z';

const task = (over: Partial<TaskContent> = {}): TaskContent => ({
  kind: 'task',
  title: '발표 자료 만들기',
  due: { kind: 'date', date: '2026-10-05' },
  completedAt: null,
  assigneeId: null,
  provenance: { origin: 'manual' },
  projectId: null,
  tags: [],
  ...over,
});

function value<T>(result: StoreResult<T> | { ok: false; error: { code: string } }): T {
  if (!result.ok) throw new Error(`실패: ${result.error.code}`);
  return result.value;
}

async function setup(content: TaskContent = task()) {
  let seq = 0;
  const store = createMemoryItemStore({ now: () => NOW, newId: () => `item-${++seq}` });
  const created = value(await store.create('u1', content)) as TaskItem;
  const toggle = createCompletionToggle({ store, ownerId: 'u1', now: () => NOW });
  return { store, created, toggle };
}

describe('DTL-TSK-002 할 일 완료', () => {
  test('누르면 완료 시각이 들어가고 저장소 version이 오른다', async () => {
    const { created, toggle } = await setup();
    const done = value(await toggle(created)) as TaskItem;
    assert.equal(done.completedAt, NOW);
    assert.equal(done.version, created.version + 1);
    assert.equal(done.title, created.title);
  });

  test('[임시 가정 OD-16] 완료한 할 일을 다시 누르면 완료가 풀린다', async () => {
    const { created, toggle } = await setup();
    const done = value(await toggle(created)) as TaskItem;
    const undone = value(await toggle(done)) as TaskItem;
    assert.equal(undone.completedAt, null);
    assert.equal(undone.version, created.version + 2);
  });

  test('저장이 끝나기 전에 같은 할 일을 또 누르면 무시한다(pending)', async () => {
    const { created, toggle } = await setup();
    const first = toggle(created);
    const second = await toggle(created);
    assert.deepEqual(second, { ok: false, error: { code: 'pending' } });
    assert.equal((value(await first) as TaskItem).completedAt, NOW);
  });

  test('다른 기기가 먼저 고쳤으면 versionConflict를 그대로 돌려준다', async () => {
    const { store, created, toggle } = await setup();
    value(await store.update('u1', created.id, created.version, task({ title: '기기 B에서 고침' })));
    const result = await toggle(created); // 예전 version으로 누름
    assert.deepEqual(result, { ok: false, error: { code: 'versionConflict', currentVersion: 2 } });
  });

  test("출처는 바꾸지 않는다: 자동 저장된 AI 할 일은 완료해도 'AI 생성' 배지가 남는다(OD-17)", async () => {
    const aiTask = task({
      provenance: { origin: 'ai', confirmation: 'autoSaved', analysisId: 'an-1', candidateId: 'cand-1', evidence: [] },
    });
    const { created, toggle } = await setup(aiTask);
    const done: Item = value(await toggle(created));
    assert.equal(showsAiBadge(done), true);
  });

  test('withCompletion: 이미 그 상태면 그대로 두고, 원래 값은 바꾸지 않는다', () => {
    const open = task();
    const closed = withCompletion(open, true, NOW);
    assert.equal(open.completedAt, null);
    assert.equal(closed.completedAt, NOW);
    assert.equal(withCompletion(closed, true, '2026-12-31T00:00:00.000Z'), closed); // 완료 시각을 덮어쓰지 않는다
    assert.equal(withCompletion(open, false, NOW), open);
  });
});
