import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item, TaskContent, TaskItem } from '../contracts/items.ts';
import { TASK_TAB_LABELS, groupTasksByTab, isDueSoon, isOverdue, taskTab } from './taskStatus.ts';

const TZ = 'Asia/Seoul';
// 서울 2026-10-06 10:00
const NOW = '2026-10-06T01:00:00.000Z';

const t = (due: TaskContent['due'], completedAt: string | null = null) => ({ due, completedAt });
const onDate = (date: string): TaskContent['due'] => ({ kind: 'date', date });
const at = (iso: string): TaskContent['due'] => ({ kind: 'instant', at: iso, timeZone: TZ });

let seq = 0;
function stored(title: string, due: TaskContent['due'], over: { completedAt?: string | null; deletedAt?: string | null } = {}): TaskItem {
  seq += 1;
  return {
    kind: 'task',
    title,
    due,
    completedAt: over.completedAt ?? null,
    assigneeId: null,
    provenance: { origin: 'manual' },
    projectId: null,
    tags: [],
    id: `t${seq}`,
    ownerId: 'u1',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: over.deletedAt ?? null,
    version: 1,
  } satisfies Item as TaskItem;
}

describe('REQ-TSK-006 기한 초과', () => {
  test('날짜 마감은 그날이 끝나야 지난다', () => {
    assert.equal(isOverdue(t(onDate('2026-10-06')), NOW, TZ), false);
    assert.equal(isOverdue(t(onDate('2026-10-05')), NOW, TZ), true);
  });

  test('시각 마감은 그 시각이 지나면 바로 지난다', () => {
    assert.equal(isOverdue(t(at('2026-10-06T00:59:59.000Z')), NOW, TZ), true);
    assert.equal(isOverdue(t(at('2026-10-06T01:00:00.000Z')), NOW, TZ), false);
  });

  test('완료했거나 마감이 없으면 기한 초과가 아니다', () => {
    assert.equal(isOverdue(t(onDate('2026-10-01'), NOW), NOW, TZ), false);
    assert.equal(isOverdue(t(null), NOW, TZ), false);
  });

  test('오늘은 계정 시간대로 센다(UTC 날짜가 아니다)', () => {
    // 서울 2026-10-07 00:30 = UTC 2026-10-06 15:30
    assert.equal(isOverdue(t(onDate('2026-10-06')), '2026-10-06T15:30:00.000Z', TZ), true);
    assert.equal(isOverdue(t(onDate('2026-10-06')), '2026-10-06T15:30:00.000Z', 'UTC'), false);
  });
});

describe('DTL-HOM-004 마감 임박(7일 이내)', () => {
  test('오늘부터 7일 뒤까지 임박, 8일 뒤는 아니다', () => {
    assert.equal(isDueSoon(t(onDate('2026-10-06')), NOW, TZ), true);
    assert.equal(isDueSoon(t(onDate('2026-10-13')), NOW, TZ), true);
    assert.equal(isDueSoon(t(onDate('2026-10-14')), NOW, TZ), false);
  });

  test('지난 것·완료한 것·마감 없는 것은 넣지 않는다', () => {
    assert.equal(isDueSoon(t(onDate('2026-10-05')), NOW, TZ), false);
    assert.equal(isDueSoon(t(onDate('2026-10-07'), NOW), NOW, TZ), false);
    assert.equal(isDueSoon(t(null), NOW, TZ), false);
  });
});

describe('DTL-TSK-001 탭 분류', () => {
  test('한 탭에만 들어간다: 완료 → 기한 초과 → 오늘 → 마감 임박 → 예정', () => {
    assert.equal(taskTab(t(onDate('2026-10-01'), NOW), NOW, TZ), 'done');
    assert.equal(taskTab(t(onDate('2026-10-05')), NOW, TZ), 'overdue');
    assert.equal(taskTab(t(onDate('2026-10-06')), NOW, TZ), 'today');
    assert.equal(taskTab(t(at('2026-10-06T00:00:00.000Z')), NOW, TZ), 'overdue', '오늘 아침 9시 마감은 10시에 이미 지났다');
    assert.equal(taskTab(t(onDate('2026-10-07')), NOW, TZ), 'dueSoon');
    assert.equal(taskTab(t(onDate('2026-10-13')), NOW, TZ), 'dueSoon');
    assert.equal(taskTab(t(onDate('2026-10-14')), NOW, TZ), 'upcoming');
    assert.equal(taskTab(t(null), NOW, TZ), 'upcoming');
  });

  test('탭 이름은 원문대로다', () => {
    assert.deepEqual(Object.values(TASK_TAB_LABELS), ['오늘', '예정', '마감 임박', '기한 초과', '완료']);
  });

  test('묶을 때 휴지통 항목은 빼고, 마감 이른 순·마감 없는 것은 뒤로 둔다', () => {
    const noDue1 = stored('마감 없음 1', null);
    const later = stored('10/20', onDate('2026-10-20'));
    const trashed = stored('지운 것', onDate('2026-10-06'), { deletedAt: NOW });
    const noDue2 = stored('마감 없음 2', null);
    const sooner = stored('10/15', onDate('2026-10-15'));
    const groups = groupTasksByTab([noDue1, later, trashed, noDue2, sooner], NOW, TZ);
    assert.deepEqual(groups.upcoming.map((x) => x.title), ['10/15', '10/20', '마감 없음 1', '마감 없음 2']);
    assert.deepEqual(groups.today, []);
  });

  test('같은 날이면 시각 마감이 날짜만 있는 마감보다 앞이다', () => {
    const dateOnly = stored('날짜만', onDate('2026-10-08'));
    const evening = stored('저녁 6시', at('2026-10-08T09:00:00.000Z'));
    const nextMorning = stored('다음 날 아침', at('2026-10-08T23:00:00.000Z')); // 서울 10/9 08:00
    const groups = groupTasksByTab([nextMorning, dateOnly, evening], NOW, TZ);
    assert.deepEqual(groups.dueSoon.map((x) => x.title), ['저녁 6시', '날짜만', '다음 날 아침']);
  });
});
