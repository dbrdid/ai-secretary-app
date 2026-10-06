import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLAN, PLAN_SPECS, canSearchRecording, canSyncAcrossDevices, checkUsage, remaining } from './plans.ts';

const RESET = '2026-11-01T00:00:00.000Z';

describe('DTL-PAY-001 요금제별 한도', () => {
  test('원문 표의 월 한도를 그대로 담는다', () => {
    assert.deepEqual(PLAN_SPECS.free.monthly, { recordingMinutes: 300, aiSummaries: 10, aiQuestions: 20 });
    assert.deepEqual(PLAN_SPECS.pro.monthly, { recordingMinutes: 2_000, aiSummaries: null, aiQuestions: 300 });
    assert.deepEqual(PLAN_SPECS.team.monthly, { recordingMinutes: 5_000, aiSummaries: null, aiQuestions: 1_000 });
  });

  test('처음 가입하면 무료다(REQ-PAY-002)', () => {
    assert.equal(DEFAULT_PLAN, 'free');
  });
});

describe('REQ-PAY-003 이용량 확인', () => {
  test('남은 양, 넘었으면 0, 무제한이면 null', () => {
    assert.equal(remaining('free', 'aiQuestions', 15), 5);
    assert.equal(remaining('free', 'aiQuestions', 25), 0);
    assert.equal(remaining('pro', 'aiSummaries', 999), null);
  });
});

describe('REQ-PAY-004 한도 초과 안내', () => {
  test('한도 안이면 받고, 넘게 되면 막고 다음 충전 시각과 올릴 요금제를 알린다', () => {
    assert.deepEqual(checkUsage('free', 'aiSummaries', 9, 1, RESET), { allowed: true });
    assert.deepEqual(checkUsage('free', 'aiSummaries', 10, 1, RESET), {
      allowed: false,
      meter: 'aiSummaries',
      limit: 10,
      resetsAt: RESET,
      upgradeTo: 'pro',
    });
  });

  test('남은 양보다 큰 요청은 받지 않는다', () => {
    assert.equal(checkUsage('free', 'recordingMinutes', 290, 20, RESET).allowed, false);
  });

  test('Team이 한도에 닿으면 올릴 요금제가 없다', () => {
    const r = checkUsage('team', 'aiQuestions', 1_000, 1, RESET);
    assert.equal(r.allowed, false);
    if (!r.allowed) assert.equal(r.upgradeTo, null);
  });

  test('무제한은 막지 않는다', () => {
    assert.equal(checkUsage('pro', 'aiSummaries', 1_000_000, 1, RESET).allowed, true);
  });
});

describe('요금제별 기능', () => {
  test('무료는 녹음 검색이 최근 7일, 유료는 전체', () => {
    assert.equal(canSearchRecording('free', 6), true);
    assert.equal(canSearchRecording('free', 7), false);
    assert.equal(canSearchRecording('pro', 365), true);
  });

  test('2026-10-06 결정: 웹↔앱 연동은 유료만', () => {
    assert.equal(canSyncAcrossDevices('free'), false);
    assert.equal(canSyncAcrossDevices('pro'), true);
    assert.equal(canSyncAcrossDevices('team'), true);
  });
});
