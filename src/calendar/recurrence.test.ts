import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { EventContent, EventSchedule, Recurrence } from '../contracts/items.ts';
import { daysBetween } from '../contracts/time.ts';
import { occurrencesInRange, type DateRange } from './recurrence.ts';

const event = (schedule: EventSchedule, recurrence: Recurrence | null = null): EventContent => ({
  kind: 'event',
  title: '주간 회의',
  schedule,
  place: null,
  recurrence,
  reminder: null,
  provenance: { origin: 'manual' },
  projectId: null,
  tags: [],
});
const timed = (start: string, end: string, timeZone = 'Asia/Seoul'): EventSchedule => ({ kind: 'timed', start, end, timeZone });
const allDay = (startDate: string, endDate = startDate): EventSchedule => ({ kind: 'allDay', startDate, endDate });
const seoul = (from: string, to = from): DateRange => ({ from, to, timeZone: 'Asia/Seoul' });
const starts = (e: EventContent, r: DateRange, rule: 'skip' | 'lastDay' = 'skip') =>
  occurrencesInRange(e, r, rule).map((o) => (o.schedule.kind === 'timed' ? o.schedule.start : o.schedule.startDate));

// 2026-09-28은 월요일. 서울 10:00~11:00 = 01:00Z~02:00Z
const mondayMeeting = timed('2026-09-28T01:00:00.000Z', '2026-09-28T02:00:00.000Z');

describe('DTL-CAL-003 반복 없는 일정', () => {
  test('범위 안이면 한 번, 밖이면 없다', () => {
    assert.deepEqual(starts(event(mondayMeeting), seoul('2026-09-28')), ['2026-09-28T01:00:00.000Z']);
    assert.deepEqual(starts(event(mondayMeeting), seoul('2026-09-29')), []);
  });

  test('범위 끝이 시작보다 앞서면 빈 목록', () => {
    assert.deepEqual(starts(event(mondayMeeting), seoul('2026-09-29', '2026-09-28')), []);
  });

  test('자정을 넘는 시각 일정은 걸친 두 날 모두에 나온다(서울 23:00~다음 날 01:00)', () => {
    const late = event(timed('2026-10-01T14:00:00.000Z', '2026-10-01T16:00:00.000Z'));
    assert.equal(starts(late, seoul('2026-10-01')).length, 1);
    assert.equal(starts(late, seoul('2026-10-02')).length, 1);
    assert.equal(starts(late, seoul('2026-10-03')).length, 0);
  });

  test('길이 0인 일정: 그날 0시 정각이면 그날, 다음 날 0시 정각이면 다음 날에만', () => {
    const atMidnight = event(timed('2026-10-01T15:00:00.000Z', '2026-10-01T15:00:00.000Z')); // 서울 10-02 00:00
    assert.equal(starts(atMidnight, seoul('2026-10-01')).length, 0);
    assert.equal(starts(atMidnight, seoul('2026-10-02')).length, 1);
  });
});

describe('DTL-CAL-003 매주 반복', () => {
  test('같은 요일·같은 시각으로 이어지고, 첫 회 앞으로는 만들지 않는다', () => {
    const weekly = event(mondayMeeting, { freq: 'weekly' });
    assert.deepEqual(starts(weekly, seoul('2026-09-21', '2026-10-25')), [
      '2026-09-28T01:00:00.000Z',
      '2026-10-05T01:00:00.000Z',
      '2026-10-12T01:00:00.000Z',
      '2026-10-19T01:00:00.000Z',
    ]);
    const second = occurrencesInRange(weekly, seoul('2026-10-05'), 'skip');
    assert.equal(second[0]?.index, 1);
    assert.deepEqual(second[0]?.schedule, timed('2026-10-05T01:00:00.000Z', '2026-10-05T02:00:00.000Z'));
  });

  test('몇 년 뒤를 봐도 회차 번호와 시각이 맞다', () => {
    const since2020 = event(timed('2020-01-06T00:00:00.000Z', '2020-01-06T01:00:00.000Z'), { freq: 'weekly' }); // 월 09:00
    const found = occurrencesInRange(since2020, seoul('2026-09-28'), 'skip');
    assert.equal(found.length, 1);
    assert.equal(found[0]?.index, daysBetween('2020-01-06', '2026-09-28') / 7);
    assert.equal(found[0]?.schedule.kind === 'timed' && found[0].schedule.start, '2026-09-28T00:00:00.000Z');
  });

  test('서머타임이 끝나도 일정 시간대의 벽시계 09:00을 지킨다(뉴욕)', () => {
    // 2026-10-26(월) 09:00 EDT = 13:00Z. 11-01에 서머타임이 끝나 11-02 09:00 EST = 14:00Z
    const ny = event(timed('2026-10-26T13:00:00.000Z', '2026-10-26T14:00:00.000Z', 'America/New_York'), { freq: 'weekly' });
    const range: DateRange = { from: '2026-11-02', to: '2026-11-02', timeZone: 'America/New_York' };
    assert.deepEqual(starts(ny, range), ['2026-11-02T14:00:00.000Z']);
  });

  test('분 아래(초)도 첫 회 값을 그대로 쓴다', () => {
    const odd = event(timed('2026-09-28T01:00:30.000Z', '2026-09-28T01:30:30.000Z'), { freq: 'weekly' });
    assert.deepEqual(starts(odd, seoul('2026-10-05')), ['2026-10-05T01:00:30.000Z']);
  });

  test('여러 날짜에 걸친 종일 일정(금~일)은 걸친 날에만 나온다', () => {
    const weekend = event(allDay('2026-10-02', '2026-10-04'), { freq: 'weekly' });
    assert.deepEqual(starts(weekend, seoul('2026-10-05')), []);
    const sat = occurrencesInRange(weekend, seoul('2026-10-10'), 'skip');
    assert.deepEqual(sat.map((o) => [o.index, o.schedule]), [[1, allDay('2026-10-09', '2026-10-11')]]);
  });
});

describe('DTL-CAL-003 매월 반복', () => {
  test('같은 날짜로 이어진다', () => {
    const monthly = event(allDay('2026-09-15'), { freq: 'monthly' });
    assert.deepEqual(starts(monthly, seoul('2026-09-01', '2026-12-31')), ['2026-09-15', '2026-10-15', '2026-11-15', '2026-12-15']);
  });

  test("[OD-13] 31일 반복, 'skip'이면 31일이 없는 달을 건너뛴다(회차 번호는 달 수)", () => {
    const payday = event(allDay('2027-01-31'), { freq: 'monthly' });
    const found = occurrencesInRange(payday, seoul('2027-01-01', '2027-06-30'), 'skip');
    assert.deepEqual(
      found.map((o) => [o.index, o.schedule.kind === 'allDay' && o.schedule.startDate]),
      [
        [0, '2027-01-31'],
        [2, '2027-03-31'],
        [4, '2027-05-31'],
      ],
    );
  });

  test("[OD-13] 31일 반복, 'lastDay'면 그 달 말일로 당긴다(윤년 2월 포함)", () => {
    const payday = event(allDay('2027-01-31'), { freq: 'monthly' });
    assert.deepEqual(starts(payday, seoul('2027-01-01', '2027-06-30'), 'lastDay'), [
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
      '2027-05-31',
      '2027-06-30',
    ]);
    assert.deepEqual(starts(payday, seoul('2028-02-01', '2028-02-29'), 'lastDay'), ['2028-02-29']);
  });

  test('시각 일정도 같은 규칙: 1월 31일 09:00(서울) 반복의 2월', () => {
    const e = event(timed('2026-01-31T00:00:00.000Z', '2026-01-31T01:00:00.000Z'), { freq: 'monthly' });
    assert.deepEqual(starts(e, seoul('2026-02-01', '2026-02-28'), 'skip'), []);
    assert.deepEqual(starts(e, seoul('2026-02-01', '2026-02-28'), 'lastDay'), ['2026-02-28T00:00:00.000Z']);
    assert.deepEqual(starts(e, seoul('2026-03-31'), 'skip'), ['2026-03-31T00:00:00.000Z']);
  });

  test('앞달에 시작해 이번 달로 넘어오는 회차도 잡는다', () => {
    const longOne = event(allDay('2026-01-30', '2026-02-02'), { freq: 'monthly' }); // 4일짜리
    const found = occurrencesInRange(longOne, seoul('2026-03-01'), 'lastDay');
    assert.deepEqual(found.map((o) => o.schedule), [allDay('2026-02-28', '2026-03-03')]);
  });
});
