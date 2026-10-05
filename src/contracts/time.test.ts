import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  daysBetween,
  isInstant,
  isLocalDate,
  isLocalTime,
  isTimeZone,
  localDateOf,
  localDateTimeOf,
  startOfLocalDay,
  weekdayOf,
  zonedDateTimeToInstant,
} from './time.ts';

describe('단계 0 날짜·시각 형식', () => {
  test('LocalDate: 달력에 있는 날짜만 받는다(윤년 포함)', () => {
    assert.equal(isLocalDate('2026-09-28'), true);
    assert.equal(isLocalDate('2028-02-29'), true);
    assert.equal(isLocalDate('2000-02-29'), true);
    assert.equal(isLocalDate('2026-02-29'), false);
    assert.equal(isLocalDate('1900-02-29'), false);
    assert.equal(isLocalDate('2026-13-01'), false);
    assert.equal(isLocalDate('2026-9-1'), false);
  });

  test('LocalTime: 00:00~23:59, 두 자리만', () => {
    assert.equal(isLocalTime('00:00'), true);
    assert.equal(isLocalTime('23:59'), true);
    assert.equal(isLocalTime('24:00'), false);
    assert.equal(isLocalTime('8:00'), false);
  });

  test("Instant: 'Z'로 끝나는 UTC 형식만 받는다(같은 순간을 여러 모양으로 저장하지 않게)", () => {
    assert.equal(isInstant('2026-09-28T00:30:00Z'), true);
    assert.equal(isInstant(new Date(0).toISOString()), true);
    assert.equal(isInstant('2026-09-28T09:30:00+09:00'), false);
    assert.equal(isInstant('2026-09-28 00:30:00Z'), false);
    assert.equal(isInstant('2026-02-30T00:00:00Z'), false);
  });

  test('TimeZone: 아는 IANA 이름만', () => {
    assert.equal(isTimeZone('Asia/Seoul'), true);
    assert.equal(isTimeZone('Mars/Base'), false);
    assert.equal(isTimeZone(''), false);
  });
});

describe("단계 0 '그날'은 계정 시간대 기준", () => {
  test('같은 순간이 서울에서는 다음 날이다', () => {
    assert.equal(localDateOf('2026-09-28T15:30:00Z', 'Asia/Seoul'), '2026-09-29');
    assert.equal(localDateOf('2026-09-28T15:30:00Z', 'UTC'), '2026-09-28');
    assert.equal(localDateOf('2026-09-28T15:30:00Z', 'America/Los_Angeles'), '2026-09-28');
  });

  test('서울 자정 경계: 14:59:59Z는 그날, 15:00:00Z부터 다음 날', () => {
    assert.equal(localDateOf('2026-09-28T14:59:59.999Z', 'Asia/Seoul'), '2026-09-28');
    assert.equal(localDateOf('2026-09-28T15:00:00.000Z', 'Asia/Seoul'), '2026-09-29');
  });
});

describe('단계 2·3 달력 날짜 계산(시간대와 무관)', () => {
  test('addDays: 달·해·윤년을 넘는다', () => {
    assert.equal(addDays('2026-09-28', 3), '2026-10-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });

  test('daysBetween: 뒤 - 앞', () => {
    assert.equal(daysBetween('2026-09-28', '2026-10-05'), 7);
    assert.equal(daysBetween('2026-10-05', '2026-09-28'), -7);
    assert.equal(daysBetween('2026-09-28', '2026-09-28'), 0);
  });

  test('weekdayOf: 2026-09-28은 월요일', () => {
    assert.equal(weekdayOf('2026-09-28'), 'mon');
    assert.equal(weekdayOf('2026-10-04'), 'sun');
    assert.equal(weekdayOf('2028-02-29'), 'tue');
  });

  test('형식이 틀린 날짜는 조용히 넘기지 않고 RangeError', () => {
    assert.throws(() => addDays('2026-02-30', 1), RangeError);
  });
});

describe('단계 3 벽시계 ↔ 순간 변환', () => {
  test('서울: 오프셋 +9시간 고정', () => {
    assert.equal(zonedDateTimeToInstant('2026-10-02', '09:00', 'Asia/Seoul'), '2026-10-02T00:00:00.000Z');
    assert.equal(zonedDateTimeToInstant('2026-10-02', '00:00', 'Asia/Seoul'), '2026-10-01T15:00:00.000Z');
    assert.deepEqual(localDateTimeOf('2026-10-01T15:00:00.000Z', 'Asia/Seoul'), { date: '2026-10-02', time: '00:00' });
  });

  test('뉴욕 여름·겨울 시간: 같은 09:00이 다른 순간이다', () => {
    assert.equal(zonedDateTimeToInstant('2026-07-01', '09:00', 'America/New_York'), '2026-07-01T13:00:00.000Z');
    assert.equal(zonedDateTimeToInstant('2026-12-01', '09:00', 'America/New_York'), '2026-12-01T14:00:00.000Z');
  });

  test('서머타임으로 없는 시각(2026-03-08 02:30 뉴욕)은 뒤로 밀려 03:30이 된다', () => {
    const at = zonedDateTimeToInstant('2026-03-08', '02:30', 'America/New_York');
    assert.equal(at, '2026-03-08T07:30:00.000Z');
    assert.deepEqual(localDateTimeOf(at, 'America/New_York'), { date: '2026-03-08', time: '03:30' });
  });

  test('두 번 있는 시각(2026-11-01 01:30 뉴욕)은 앞의 것(서머타임 쪽)을 고른다', () => {
    assert.equal(zonedDateTimeToInstant('2026-11-01', '01:30', 'America/New_York'), '2026-11-01T05:30:00.000Z');
  });

  test('startOfLocalDay: 그 시간대에서 그날이 시작되는 순간', () => {
    assert.equal(startOfLocalDay('2026-09-29', 'Asia/Seoul'), '2026-09-28T15:00:00.000Z');
    assert.equal(startOfLocalDay('2026-09-29', 'UTC'), '2026-09-29T00:00:00.000Z');
  });
});
