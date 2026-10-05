import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptDeviceTimeZone,
  canonicalTimeZone,
  declineDeviceTimeZone,
  sameTimeZone,
  timeZonePrompt,
} from './timeZoneCheck.ts';
import { defaultOnboardingSettings } from '../onboarding/skipOnboarding.ts';

// 이 엔진이 별칭을 정식 이름으로 맞춰 주는지. 맞춰 주지 않는 엔진(새 규칙)에서는 별칭 테스트를 건너뛴다.
const engineCanonicalizesAliases = canonicalTimeZone('US/Eastern') === canonicalTimeZone('America/New_York');

describe('DTL-SET-013 저장된 시간대와 기기 시간대 비교', () => {
  test('같으면 묻지 않는다', () => {
    assert.deepEqual(timeZonePrompt({ saved: 'Asia/Seoul', device: 'Asia/Seoul' }), { ask: false, reason: 'same' });
  });

  test('다르면 묻는다. 묻는 값은 기기가 알려 준 이름 그대로다', () => {
    assert.deepEqual(timeZonePrompt({ saved: 'Asia/Seoul', device: 'America/New_York' }), {
      ask: true,
      saved: 'Asia/Seoul',
      device: 'America/New_York',
    });
  });

  test('시차가 같아도 다른 도시면 원문대로 묻는다(서울↔도쿄, OD-10)', () => {
    assert.equal(timeZonePrompt({ saved: 'Asia/Seoul', device: 'Asia/Tokyo' }).ask, true);
  });

  test('기기 시간대를 못 읽거나 모르는 이름이면 묻지 않는다(Asia/Seoul로 채워 비교하지 않는다)', () => {
    assert.deepEqual(timeZonePrompt({ saved: 'America/New_York', device: undefined }), { ask: false, reason: 'deviceUnknown' });
    assert.deepEqual(timeZonePrompt({ saved: 'America/New_York', device: '' }), { ask: false, reason: 'deviceUnknown' });
    assert.deepEqual(timeZonePrompt({ saved: 'America/New_York', device: 'Mars/Olympus' }), { ask: false, reason: 'deviceUnknown' });
  });

  test('대소문자만 다른 이름은 같은 시간대다', () => {
    assert.equal(sameTimeZone('Asia/Seoul', 'asia/seoul'), true);
  });

  test('같은 곳의 다른 이름(별칭)은 같은 시간대로 보고 묻지 않는다', { skip: !engineCanonicalizesAliases && '이 엔진은 별칭을 맞춰 주지 않음' }, () => {
    assert.equal(sameTimeZone('Asia/Kolkata', 'Asia/Calcutta'), true);
    assert.equal(sameTimeZone('US/Eastern', 'America/New_York'), true);
    assert.equal(sameTimeZone('Etc/UTC', 'UTC'), true);
    assert.deepEqual(timeZonePrompt({ saved: 'Asia/Calcutta', device: 'Asia/Kolkata' }), { ask: false, reason: 'same' });
  });

  test('모르는 이름끼리는 글자가 같을 때만 같다', () => {
    assert.equal(sameTimeZone('Mars/Olympus', 'Mars/Olympus'), true);
    assert.equal(sameTimeZone('Mars/Olympus', 'Mars/Base'), false);
  });
});

describe('DTL-SET-013 팝업 응답', () => {
  test('[임시 가정] 바꾸기: 시각은 그대로, 시간대만 바뀐다', () => {
    const before = defaultOnboardingSettings('Asia/Seoul');
    const after = acceptDeviceTimeZone(before, 'America/New_York');
    assert.equal(after.timeZone, 'America/New_York');
    assert.deepEqual(after.dailyBriefing, { enabled: true, time: '08:00' });
    assert.equal(before.timeZone, 'Asia/Seoul'); // 원래 값은 바꾸지 않는다
  });

  test('[임시 가정] 바꾸지 않음: 같은 조합이면 다시 묻지 않는다', () => {
    const declined = declineDeviceTimeZone('Asia/Seoul', 'Asia/Tokyo');
    assert.deepEqual(timeZonePrompt({ saved: 'Asia/Seoul', device: 'Asia/Tokyo', declined }), { ask: false, reason: 'declinedBefore' });
  });

  test('[임시 가정] 거절한 뒤라도 기기 시간대나 저장값이 또 바뀌면 다시 묻는다', () => {
    const declined = declineDeviceTimeZone('Asia/Seoul', 'Asia/Tokyo');
    assert.equal(timeZonePrompt({ saved: 'Asia/Seoul', device: 'Europe/Paris', declined }).ask, true);
    assert.equal(timeZonePrompt({ saved: 'America/New_York', device: 'Asia/Tokyo', declined }).ask, true);
  });
});
