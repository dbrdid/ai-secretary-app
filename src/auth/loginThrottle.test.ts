import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOGIN_BLOCK_MS,
  LOGIN_MESSAGES,
  LOGIN_THROTTLE_CLEAR,
  checkLoginGate,
  checkLoginInput,
  recordLoginAttempt,
  throttleKey,
  type LoginThrottle,
} from './loginThrottle.ts';

const T0 = 1_000_000;

function failTimes(n: number, at = T0): LoginThrottle {
  let state = LOGIN_THROTTLE_CLEAR;
  for (let i = 0; i < n; i += 1) state = recordLoginAttempt(state, false, at).state;
  return state;
}

describe('DTL-AUT-031 로그인 빈 칸 검사', () => {
  test('비어 있는 칸마다 원문 문구를 낸다', () => {
    assert.deepEqual(checkLoginInput('', ''), [
      { field: 'email', message: LOGIN_MESSAGES.emailRequired },
      { field: 'password', message: LOGIN_MESSAGES.passwordRequired },
    ]);
    assert.deepEqual(checkLoginInput('  ', 'pw'), [{ field: 'email', message: '이메일을 입력해 주세요' }]);
    assert.deepEqual(checkLoginInput('a@b.com', ''), [{ field: 'password', message: '비밀번호를 입력해 주세요' }]);
  });

  test('비밀번호 복잡도는 검사하지 않는다', () => {
    assert.deepEqual(checkLoginInput('a@b.com', '1'), []);
  });
});

describe('DTL-AUT-033·034 연속 실패 차단', () => {
  test('4회까지는 통일 문구, 5회째에 10분 차단 문구', () => {
    let state = LOGIN_THROTTLE_CLEAR;
    const messages: (string | null)[] = [];
    for (let i = 0; i < 5; i += 1) {
      const r = recordLoginAttempt(state, false, T0);
      messages.push(r.message);
      state = r.state;
    }
    assert.deepEqual(messages, [...Array(4).fill('이메일 또는 비밀번호가 일치하지 않습니다'), '로그인 시도 횟수를 초과했습니다. 10분 후 다시 시도해 주세요']);
    assert.deepEqual(checkLoginGate(state, T0 + 1), { allowed: false, retryAt: T0 + LOGIN_BLOCK_MS, message: LOGIN_MESSAGES.blocked });
  });

  test('10분이 지나면 다시 시도할 수 있고 처음부터 센다', () => {
    const blocked = failTimes(5);
    assert.equal(checkLoginGate(blocked, T0 + LOGIN_BLOCK_MS - 1).allowed, false);
    assert.equal(checkLoginGate(blocked, T0 + LOGIN_BLOCK_MS).allowed, true);
    const after = recordLoginAttempt(blocked, false, T0 + LOGIN_BLOCK_MS);
    assert.deepEqual(after.state, { failures: 1, blockedUntil: null });
    assert.equal(after.message, LOGIN_MESSAGES.mismatch);
  });

  test('성공하면 실패 횟수를 0으로 되돌린다', () => {
    assert.deepEqual(recordLoginAttempt(failTimes(4), true, T0).state, LOGIN_THROTTLE_CLEAR);
  });

  test('가입 여부와 대소문자에 관계없이 같은 열쇠로 센다', () => {
    assert.equal(throttleKey('  Kim@Example.com '), throttleKey('kim@example.com'));
  });
});
