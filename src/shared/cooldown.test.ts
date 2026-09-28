import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { COOLDOWN_READY, isCoolingDown, press, remainingSeconds } from './cooldown.ts';

const T0 = 1_000_000; // 가짜 시계의 누른 시각(ms)

describe('DTL-AUT-026 [재발송] 60초 대기', () => {
  test('누르기 전에는 대기가 없다', () => {
    assert.equal(remainingSeconds(COOLDOWN_READY, T0), 0);
    assert.equal(isCoolingDown(COOLDOWN_READY, T0), false);
  });

  test('누르면 받아들이고 버튼에 60부터 1까지 남은 초를 보인 뒤 60초에 다시 켠다', () => {
    const { accepted, cooldown } = press(COOLDOWN_READY, T0);
    assert.equal(accepted, true);
    const shown = Array.from({ length: 61 }, (_, s) => remainingSeconds(cooldown, T0 + s * 1000));
    assert.deepEqual(shown, [...Array.from({ length: 60 }, (_, i) => 60 - i), 0]);
  });

  test('60초 경계: 59.999초에는 1초 남음(비활성), 60초 정각에 활성', () => {
    const { cooldown } = press(COOLDOWN_READY, T0);
    assert.equal(remainingSeconds(cooldown, T0 + 1), 60);
    assert.equal(remainingSeconds(cooldown, T0 + 59_999), 1);
    assert.equal(isCoolingDown(cooldown, T0 + 59_999), true);
    assert.equal(isCoolingDown(cooldown, T0 + 60_000), false);
    assert.equal(press(cooldown, T0 + 60_000).accepted, true);
  });

  test('더블 클릭: 대기 중에 들어온 두 번째 누름은 받지 않고 대기도 늘리지 않는다', () => {
    const first = press(COOLDOWN_READY, T0);
    const second = press(first.cooldown, T0 + 50);
    assert.equal(second.accepted, false);
    assert.deepEqual(second.cooldown, first.cooldown);
    const later = press(first.cooldown, T0 + 30_000);
    assert.equal(later.accepted, false);
    assert.equal(remainingSeconds(later.cooldown, T0 + 30_000), 30);
  });
});

describe('DTL-AUT-049 [재설정 링크 받기] 60초 대기 (DTL-AUT-026과 같은 계산)', () => {
  test('누른 뒤 60초 동안 받지 않고 남은 초를 보이며, 60초가 지나면 다시 받는다', () => {
    const { accepted, cooldown } = press(COOLDOWN_READY, T0);
    assert.equal(accepted, true);
    assert.equal(remainingSeconds(cooldown, T0), 60);
    assert.equal(press(cooldown, T0 + 45_000).accepted, false);
    assert.equal(remainingSeconds(cooldown, T0 + 45_000), 15);
    assert.equal(press(cooldown, T0 + 60_000).accepted, true);
  });
});
