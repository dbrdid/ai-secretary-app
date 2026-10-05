import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { EventContent, Item, ItemContent, MemoContent, TaskContent } from '../contracts/items.ts';
import { localDateOf } from '../contracts/time.ts';
import { dayAgenda, noRelatedMemos, type RelatedMemoRule } from './dayAgenda.ts';

let seq = 0;
function stored(content: ItemContent, over: Partial<Pick<Item, 'createdAt' | 'deletedAt'>> = {}): Item {
  seq += 1;
  return {
    ...content,
    id: `item-${seq}`,
    ownerId: 'u1',
    createdAt: over.createdAt ?? '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    deletedAt: over.deletedAt ?? null,
    version: 1,
  } as Item;
}
const common = { provenance: { origin: 'manual' as const }, projectId: null, tags: [] };
const ev = (title: string, schedule: EventContent['schedule'], recurrence: EventContent['recurrence'] = null): EventContent => ({
  kind: 'event',
  title,
  schedule,
  place: null,
  recurrence,
  reminder: null,
  ...common,
});
const task = (title: string, due: TaskContent['due'], completedAt: string | null = null): TaskContent => ({
  kind: 'task',
  title,
  due,
  completedAt,
  assigneeId: null,
  ...common,
});
const memo = (body: string): MemoContent => ({ kind: 'memo', body, ...common });

const opts = { timeZone: 'Asia/Seoul', monthEnd: 'skip' as const, relatedMemo: noRelatedMemos };
const titles = (list: readonly { title: string }[]) => list.map((x) => x.title);

// 2026-10-05(월)을 서울 기준으로 본다.
const items: Item[] = [
  stored(ev('주간 회의 10시', { kind: 'timed', start: '2026-09-28T01:00:00.000Z', end: '2026-09-28T02:00:00.000Z', timeZone: 'Asia/Seoul' }, { freq: 'weekly' })),
  stored(ev('종일: 한글날 준비', { kind: 'allDay', startDate: '2026-10-05', endDate: '2026-10-09' })),
  stored(ev('아침 8시 통화', { kind: 'timed', start: '2026-10-04T23:00:00.000Z', end: '2026-10-04T23:30:00.000Z', timeZone: 'Asia/Seoul' })),
  stored(ev('다음 날 일정', { kind: 'allDay', startDate: '2026-10-06', endDate: '2026-10-06' })),
  stored(ev('휴지통의 일정', { kind: 'allDay', startDate: '2026-10-05', endDate: '2026-10-05' }), { deletedAt: '2026-10-01T00:00:00.000Z' }),
  stored(task('날짜만 마감', { kind: 'date', date: '2026-10-05' })),
  stored(task('저녁 6시 마감', { kind: 'instant', at: '2026-10-05T09:00:00.000Z', timeZone: 'Asia/Seoul' })),
  stored(task('UTC로는 전날, 서울로는 그날 새벽 5시', { kind: 'instant', at: '2026-10-04T20:00:00.000Z', timeZone: 'UTC' })),
  stored(task('이미 끝낸 일', { kind: 'date', date: '2026-10-05' }, '2026-10-03T00:00:00.000Z')),
  stored(task('다음 날 마감', { kind: 'date', date: '2026-10-06' })),
  stored(task('마감 없음', null)),
  stored(memo('10월 5일에 쓴 메모'), { createdAt: '2026-10-05T03:00:00.000Z' }),
  stored(memo('예전 메모')),
];

describe('DTL-CAL-002 날짜별 목록', () => {
  test('일정: 그날과 겹치는 회차만, 종일 먼저 그다음 시작 순(반복 회차 포함, 휴지통 제외)', () => {
    const day = dayAgenda(items, '2026-10-05', opts);
    assert.deepEqual(titles(day.events.map((o) => o.event)), ['종일: 한글날 준비', '아침 8시 통화', '주간 회의 10시']);
    assert.equal(day.events[2]?.index, 1); // 매주 반복의 두 번째 회차
  });

  test('할 일: 마감이 계정 시간대로 그날인 것. 시각 마감을 시각 순으로 먼저, 완료한 것도 넣는다', () => {
    const day = dayAgenda(items, '2026-10-05', opts);
    assert.deepEqual(titles(day.tasks), ['UTC로는 전날, 서울로는 그날 새벽 5시', '저녁 6시 마감', '날짜만 마감', '이미 끝낸 일']);
  });

  test('같은 목록도 계정 시간대가 다르면 날짜가 달라진다(UTC 계정에서는 새벽 5시 마감이 전날)', () => {
    const day = dayAgenda(items, '2026-10-05', { ...opts, timeZone: 'UTC' });
    assert.equal(titles(day.tasks).includes('UTC로는 전날, 서울로는 그날 새벽 5시'), false);
  });

  test('[OD-15] 관련 메모 기준이 없으면 메모는 넣지 않는다', () => {
    assert.deepEqual(dayAgenda(items, '2026-10-05', opts).memos, []);
  });

  test('[OD-15] 기준을 넘기면 그대로 쓴다(예시 기준: 그날 쓴 메모)', () => {
    const writtenThatDay: RelatedMemoRule = (m, day) => localDateOf(m.createdAt, day.timeZone) === day.date;
    const day = dayAgenda(items, '2026-10-05', { ...opts, relatedMemo: writtenThatDay });
    assert.deepEqual(day.memos.map((m) => m.body), ['10월 5일에 쓴 메모']);
  });

  test('아무것도 없는 날은 세 목록 모두 비어 있다', () => {
    const day = dayAgenda(items, '2026-09-01', opts);
    assert.deepEqual([day.events.length, day.tasks.length, day.memos.length], [0, 0, 0]);
  });
});
