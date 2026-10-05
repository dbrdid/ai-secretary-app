import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { MemoContent, TaskContent } from '../../contracts/items.ts';
import type { StoreResult } from '../../contracts/itemStore.ts';
import { createMemoryItemStore } from './memoryItemStore.ts';

const DAY = 24 * 60 * 60 * 1000;

function setup() {
  let nowMs = Date.parse('2026-09-28T00:00:00.000Z');
  let seq = 0;
  const store = createMemoryItemStore({ now: () => new Date(nowMs).toISOString(), newId: () => `item-${++seq}` });
  return {
    store,
    advance(ms: number) {
      nowMs += ms;
    },
  };
}

function value<T>(result: StoreResult<T>): T {
  if (!result.ok) throw new Error(`저장소 실패: ${result.error.code}`);
  return result.value;
}

const memo = (body = '금요일까지 발표 자료 정리'): MemoContent => ({ kind: 'memo', body, provenance: { origin: 'manual' }, projectId: null, tags: [] });
const aiTask = (candidateId: string): TaskContent => ({
  kind: 'task',
  title: '발표 자료 만들기',
  due: { kind: 'date', date: '2026-10-02' },
  completedAt: null,
  assigneeId: null,
  provenance: { origin: 'ai', confirmation: 'userConfirmed', analysisId: 'an-1', candidateId, evidence: [] },
  projectId: null,
  tags: [],
});

describe('단계 0 가짜 저장소: 저장·고치기', () => {
  test('id·시각·version은 저장소가 정하고, 받은 객체를 고쳐도 저장값은 그대로다', async () => {
    const { store } = setup();
    const created = value(await store.create('u1', memo()));
    assert.equal(created.id, 'item-1');
    assert.equal(created.version, 1);
    assert.equal(created.createdAt, '2026-09-28T00:00:00.000Z');
    assert.equal(created.deletedAt, null);

    (created as { body: string }).body = '바꿔치기';
    const again = value(await store.get('u1', 'item-1'));
    assert.equal(again.kind === 'memo' && again.body, '금요일까지 발표 자료 정리');
  });

  test('다른 기기가 먼저 고쳤으면 versionConflict와 현재 version을 돌려준다', async () => {
    const { store, advance } = setup();
    value(await store.create('u1', memo()));
    advance(1000);
    const first = value(await store.update('u1', 'item-1', 1, memo('기기 A에서 고침')));
    assert.equal(first.version, 2);
    assert.equal(first.updatedAt, '2026-09-28T00:00:01.000Z');
    assert.equal(first.createdAt, '2026-09-28T00:00:00.000Z');

    assert.deepEqual(await store.update('u1', 'item-1', 1, memo('기기 B의 옛 화면에서 고침')), {
      ok: false,
      error: { code: 'versionConflict', currentVersion: 2 },
    });
  });

  test('다른 사용자의 항목은 없는 것처럼 답하고(notFound) 목록에도 없다', async () => {
    const { store } = setup();
    value(await store.create('u1', memo()));
    assert.deepEqual(await store.get('u2', 'item-1'), { ok: false, error: { code: 'notFound' } });
    assert.deepEqual(await store.update('u2', 'item-1', 1, memo('남의 것')), { ok: false, error: { code: 'notFound' } });
    assert.deepEqual(await store.moveToTrash('u2', 'item-1'), { ok: false, error: { code: 'notFound' } });
    assert.deepEqual(await store.list('u2'), []);
  });

  test('종류를 바꾸는 고치기와 규칙에 어긋난 내용은 받지 않는다', async () => {
    const { store } = setup();
    value(await store.create('u1', memo()));
    assert.deepEqual(await store.update('u1', 'item-1', 1, aiTask('c-1')), { ok: false, error: { code: 'kindMismatch' } });
    assert.deepEqual(await store.update('u1', 'item-1', 1, memo('  ')), { ok: false, error: { code: 'invalidContent', problems: ['emptyBody'] } });
    assert.deepEqual(await store.create('u1', memo('')), { ok: false, error: { code: 'invalidContent', problems: ['emptyBody'] } });
  });

  test('목록은 휴지통을 빼고 종류로 거를 수 있다', async () => {
    const { store } = setup();
    value(await store.create('u1', memo()));
    value(await store.create('u1', aiTask('c-1')));
    assert.deepEqual((await store.list('u1')).map((i) => i.id), ['item-1', 'item-2']);
    assert.deepEqual((await store.list('u1', 'task')).map((i) => i.id), ['item-2']);
  });

  test('AI 재시도: 같은 후보(candidateId)는 한 번만 저장된다', async () => {
    const { store } = setup();
    const first = value(await store.create('u1', aiTask('c-1')));
    const retry = value(await store.create('u1', aiTask('c-1')));
    assert.equal(retry.id, first.id);
    assert.equal((await store.list('u1')).length, 1);
    value(await store.create('u2', aiTask('c-1'))); // 다른 사용자의 같은 후보 ID는 별개
    assert.equal((await store.list('u2')).length, 1);
  });
});

describe('DTL-SYS-001 가짜 저장소: 휴지통', () => {
  test('옮기면 목록에서 빠지고 휴지통에 보이며, 두 번 옮겨도 같은 결과다', async () => {
    const { store } = setup();
    value(await store.create('u1', memo()));
    const trashed = value(await store.moveToTrash('u1', 'item-1'));
    assert.equal(trashed.deletedAt, '2026-09-28T00:00:00.000Z');
    assert.equal(trashed.version, 2);
    assert.deepEqual(await store.moveToTrash('u1', 'item-1'), { ok: true, value: trashed });
    assert.deepEqual(await store.list('u1'), []);
    assert.deepEqual((await store.listTrash('u1')).map((i) => i.id), ['item-1']);
    assert.equal(value(await store.get('u1', 'item-1')).deletedAt, trashed.deletedAt);
  });

  test('휴지통 항목은 고칠 수 없고, 복원하면 목록으로 돌아온다', async () => {
    const { store } = setup();
    value(await store.create('u1', memo()));
    value(await store.moveToTrash('u1', 'item-1'));
    assert.deepEqual(await store.update('u1', 'item-1', 2, memo('고침')), { ok: false, error: { code: 'inTrash' } });
    const restored = value(await store.restore('u1', 'item-1'));
    assert.equal(restored.deletedAt, null);
    assert.equal(restored.version, 3);
    assert.deepEqual((await store.list('u1')).map((i) => i.id), ['item-1']);
    assert.deepEqual(await store.restore('u1', 'item-1'), { ok: false, error: { code: 'notInTrash' } });
  });

  test('30일 경계: 만료 1ms 전에는 복원, 만료 정각에는 restoreExpired이고 휴지통 목록에서도 빠진다', async () => {
    const early = setup();
    value(await early.store.create('u1', memo()));
    value(await early.store.moveToTrash('u1', 'item-1'));
    early.advance(30 * DAY - 1);
    assert.equal((await early.store.restore('u1', 'item-1')).ok, true);

    const late = setup();
    value(await late.store.create('u1', memo()));
    value(await late.store.moveToTrash('u1', 'item-1'));
    late.advance(30 * DAY);
    assert.deepEqual(await late.store.restore('u1', 'item-1'), { ok: false, error: { code: 'restoreExpired' } });
    assert.deepEqual(await late.store.listTrash('u1'), []);
  });

  test('영구 삭제는 휴지통 항목만 받는다', async () => {
    const { store } = setup();
    value(await store.create('u1', memo()));
    assert.deepEqual(await store.purge('u1', 'item-1'), { ok: false, error: { code: 'notInTrash' } });
    value(await store.moveToTrash('u1', 'item-1'));
    assert.deepEqual(await store.purge('u1', 'item-1'), { ok: true, value: null });
    assert.deepEqual(await store.get('u1', 'item-1'), { ok: false, error: { code: 'notFound' } });
  });

  test('서버 예약 작업 흉내: 기간이 지난 휴지통 항목만 파기한다', async () => {
    const { store, advance } = setup();
    value(await store.create('u1', memo('오래된 것')));
    value(await store.create('u1', memo('최근 것')));
    value(await store.create('u1', memo('남길 것')));
    value(await store.moveToTrash('u1', 'item-1'));
    advance(10 * DAY);
    value(await store.moveToTrash('u1', 'item-2'));
    advance(20 * DAY); // item-1은 30일째, item-2는 20일째
    assert.equal(await store.purgeExpired(), 1);
    assert.deepEqual(await store.get('u1', 'item-1'), { ok: false, error: { code: 'notFound' } });
    assert.deepEqual((await store.listTrash('u1')).map((i) => i.id), ['item-2']);
    assert.deepEqual((await store.list('u1')).map((i) => i.id), ['item-3']);
  });
});
