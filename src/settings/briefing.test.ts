import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_BRIEFING_DEFAULT,
  DAILY_BRIEFING_TIMES,
  WEEKLY_BRIEFING_DEFAULT,
  WEEKLY_BRIEFING_SUGGESTION,
  checkBriefingSettings,
  isDailyBriefingTime,
  turnOffWeekly,
  turnOnWeekly,
  type BriefingSettings,
  type WeeklyBriefing,
} from './briefing.ts';
import { defaultOnboardingSettings } from '../onboarding/skipOnboarding.ts';

const settings = (over: Partial<BriefingSettings> = {}): BriefingSettings => ({
  dailyBriefing: DAILY_BRIEFING_DEFAULT,
  weeklyBriefing: WEEKLY_BRIEFING_DEFAULT,
  timeZone: 'Asia/Seoul',
  ...over,
});

describe('DTL-SET-011 일간 브리핑 시각', () => {
  test('기본값은 켜짐, 08:00', () => {
    assert.deepEqual(DAILY_BRIEFING_DEFAULT, { enabled: true, time: '08:00' });
  });

  test('선택지는 00:00부터 23:30까지 30분 단위 48개', () => {
    assert.equal(DAILY_BRIEFING_TIMES.length, 48);
    assert.equal(DAILY_BRIEFING_TIMES[0], '00:00');
    assert.equal(DAILY_BRIEFING_TIMES[1], '00:30');
    assert.equal(DAILY_BRIEFING_TIMES[16], '08:00');
    assert.equal(DAILY_BRIEFING_TIMES[47], '23:30');
    assert.ok(DAILY_BRIEFING_TIMES.every(isDailyBriefingTime));
  });

  test('30분 단위가 아니거나 형식이 틀리면 받지 않는다', () => {
    for (const bad of ['08:15', '08:01', '23:59', '24:00', '8:00', '', '08:00:00']) {
      assert.equal(isDailyBriefingTime(bad), false, bad);
    }
  });

  test('꺼져 있어도 남긴 시각은 검사한다(다시 켤 때 그 시각을 쓴다)', () => {
    assert.deepEqual(checkBriefingSettings(settings({ dailyBriefing: { enabled: false, time: '07:30' } })), []);
    assert.deepEqual(checkBriefingSettings(settings({ dailyBriefing: { enabled: false, time: '07:45' } })), ['invalidDailyTime']);
  });
});

describe('DTL-SET-012 주간 브리핑 요일·시각', () => {
  test('기본값은 꺼짐이고, 건너뛰기 기본값({ enabled: false })과 같은 모양이다', () => {
    assert.deepEqual(WEEKLY_BRIEFING_DEFAULT, { enabled: false });
    assert.deepEqual(defaultOnboardingSettings('Asia/Seoul').weeklyBriefing, WEEKLY_BRIEFING_DEFAULT);
    assert.deepEqual(checkBriefingSettings(settings()), []);
  });

  test('처음 켜면 초기 제안값 월요일 08:30', () => {
    assert.deepEqual(WEEKLY_BRIEFING_SUGGESTION, { weekday: 'mon', time: '08:30' });
    assert.deepEqual(turnOnWeekly({ enabled: false }), { enabled: true, weekday: 'mon', time: '08:30' });
  });

  test('[임시 가정] 끄면 고른 값을 남기고, 다시 켜면 그 값을 쓴다', () => {
    const chosen: WeeklyBriefing = { enabled: true, weekday: 'fri', time: '18:00' };
    const off = turnOffWeekly(chosen);
    assert.deepEqual(off, { enabled: false, weekday: 'fri', time: '18:00' });
    assert.deepEqual(checkBriefingSettings(settings({ weeklyBriefing: off })), []);
    assert.deepEqual(turnOnWeekly(off), chosen);
  });

  test('이미 켜진 것을 켜거나 꺼진 것을 꺼도 값이 그대로다', () => {
    const on: WeeklyBriefing = { enabled: true, weekday: 'wed', time: '09:00' };
    assert.equal(turnOnWeekly(on), on);
    const off: WeeklyBriefing = { enabled: false };
    assert.equal(turnOffWeekly(off), off);
  });

  test('켜졌는데 요일·시각이 없거나 모르는 값이면 문제로 알린다', () => {
    // 서버 응답(JSON)은 타입이 보장하지 않으므로 틀린 값을 억지로 만들어 넣는다.
    const bad = (w: unknown) => checkBriefingSettings(settings({ weeklyBriefing: w as WeeklyBriefing }));
    assert.deepEqual(bad({ enabled: true, time: '08:30' }), ['invalidWeekday']);
    assert.deepEqual(bad({ enabled: true, weekday: 'monday', time: '08:30' }), ['invalidWeekday']);
    assert.deepEqual(bad({ enabled: true, weekday: 'mon' }), ['invalidWeeklyTime']);
    assert.deepEqual(bad({ enabled: true, weekday: 'mon', time: '8:30' }), ['invalidWeeklyTime']);
    assert.deepEqual(bad({ enabled: false, weekday: 'mon' }), ['invalidWeeklyTime']);
  });

  test('[임시 가정] 주간 시각은 30분 단위를 강제하지 않는다(원문은 일간에만 적음, OD-09)', () => {
    assert.deepEqual(checkBriefingSettings(settings({ weeklyBriefing: { enabled: true, weekday: 'sun', time: '21:15' } })), []);
  });
});

describe('DTL-SET-013 시간대와 함께 저장', () => {
  test('모르는 시간대 이름은 저장 전에 막는다', () => {
    assert.deepEqual(checkBriefingSettings(settings({ timeZone: 'Mars/Olympus' })), ['invalidTimeZone']);
    assert.deepEqual(checkBriefingSettings(settings({ timeZone: '' })), ['invalidTimeZone']);
  });
});
