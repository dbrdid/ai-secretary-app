import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { EventContent, EventItem } from '../contracts/items.ts';
import { daysUntilEvent, findOverlaps } from './overlap.ts';

const TZ = 'Asia/Seoul';
const opts = { timeZone: TZ, monthEnd: 'skip' as const };

let seq = 0;
function event(title: string, schedule: EventContent['schedule'], over: { recurrence?: EventContent['recurrence']; deletedAt?: string | null; id?: string } = {}): EventItem {
  seq += 1;
  return {
    kind: 'event',
    title,
    schedule,
    place: null,
    recurrence: over.recurrence ?? null,
    reminder: null,
    provenance: { origin: 'manual' },
    projectId: null,
    tags: [],
    id: over.id ?? `e${seq}`,
    ownerId: 'u1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    deletedAt: over.deletedAt ?? null,
    version: 1,
  };
}
// 서울 시각으로 쓰기 쉽게: kst('2026-10-06', 10) → 그날 10:00(서울)
const kst = (date: string, hour: number, minute = 0) => new Date(Date.parse(`${date}T00:00:00Z`) + (hour - 9) * 3_600_000 + minute * 60_000).toISOString();
const timed = (date: string, from: number, to: number): EventContent['schedule'] => ({ kind: 'timed', start: kst(date, from), end: kst(date, to), timeZone: TZ });

describe('REQ-CAL-005 일정 겹침 안내', () => {
  test('시간이 겹치는 기존 일정을 알려 준다', () => {
    const meeting = event('회의', timed('2026-10-06', 10, 11));
    const lunch = event('점심', timed('2026-10-06', 12, 13));
    const hits = findOverlaps({ schedule: timed('2026-10-06', 10.5, 12.5) }, [meeting, lunch], opts);
    assert.deepEqual(hits.map((h) => h.event.title), ['회의', '점심']);
  });

  test('끝나는 순간 시작하는 일정은 겹치지 않는다', () => {
    const meeting = event('회의', timed('2026-10-06', 10, 11));
    assert.deepEqual(findOverlaps({ schedule: timed('2026-10-06', 11, 12) }, [meeting], opts), []);
  });

  test('반복 일정은 그 회차로 본다', () => {
    const weekly = event('주간 회의', timed('2026-09-29', 10, 11), { recurrence: { freq: 'weekly' } }); // 화요일마다
    const hits = findOverlaps({ schedule: timed('2026-10-06', 10, 10.5) }, [weekly], opts);
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.index, 1);
  });

  test('종일 일정, 휴지통 일정, 고치는 중인 자기 자신은 빼고 본다', () => {
    const holiday = event('휴가', { kind: 'allDay', startDate: '2026-10-06', endDate: '2026-10-06' });
    const trashed = event('지운 회의', timed('2026-10-06', 10, 11), { deletedAt: '2026-10-01T00:00:00.000Z' });
    const self = event('나', timed('2026-10-06', 10, 11), { id: 'me' });
    assert.deepEqual(findOverlaps({ schedule: timed('2026-10-06', 10, 11) }, [holiday, trashed, self], { ...opts, excludeId: 'me' }), []);
  });

  test('새 일정이 종일 일정이면 안내하지 않는다', () => {
    const meeting = event('회의', timed('2026-10-06', 10, 11));
    assert.deepEqual(findOverlaps({ schedule: { kind: 'allDay', startDate: '2026-10-06', endDate: '2026-10-06' } }, [meeting], opts), []);
  });

  test('자정을 넘는 일정도 다음 날 일정과 겹치는지 본다', () => {
    const early = event('새벽 작업', timed('2026-10-07', 1, 2));
    const overnight: EventContent['schedule'] = { kind: 'timed', start: kst('2026-10-06', 23), end: kst('2026-10-07', 1, 30), timeZone: TZ };
    assert.deepEqual(findOverlaps({ schedule: overnight }, [early], opts).map((h) => h.event.title), ['새벽 작업']);
  });
});

describe('REQ-CAL-014 남은 기간', () => {
  const now = kst('2026-10-06', 22);
  test('계정 시간대 날짜로 센다: 오늘 0, 내일 1, 어제 -1', () => {
    assert.equal(daysUntilEvent(timed('2026-10-06', 9, 10), now, TZ), 0);
    assert.equal(daysUntilEvent(timed('2026-10-07', 1, 2), now, TZ), 1);
    assert.equal(daysUntilEvent({ kind: 'allDay', startDate: '2026-10-05', endDate: '2026-10-05' }, now, TZ), -1);
  });
});
