import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CODE_MESSAGES,
  CODE_VALID_MS,
  RESEND_WINDOW_MS,
  formatCountdown,
  generateCode,
  isInputDisabled,
  issueCode,
  remainingMs,
  sanitizeCodeInput,
  shouldAutoSubmit,
  tryResend,
  verifyCode,
  type IssuedCode,
} from './verificationCode.ts';

const T0 = 1_000_000;
const fixed = (digits: number[]) => {
  let i = 0;
  return () => digits[i++ % digits.length] as number;
};

describe('DTL-AUT-023 인증번호 입력 정리와 자동 제출', () => {
  test('숫자만 남기고 6자리까지 자른다(붙여넣기 포함)', () => {
    assert.equal(sanitizeCodeInput('123 456'), '123456');
    assert.equal(sanitizeCodeInput('123-456-789'), '123456');
    assert.equal(sanitizeCodeInput('ab1c2'), '12');
    assert.equal(sanitizeCodeInput('１２３'), '', '전각 숫자는 받지 않는다');
  });

  test('6자리를 모두 넣으면 자동 제출, 그 전에는 하지 않는다', () => {
    assert.equal(shouldAutoSubmit('12345'), false);
    assert.equal(shouldAutoSubmit('123456'), true);
    assert.equal(shouldAutoSubmit('12345a'), false);
  });
});

describe('DTL-AUT-021·025 타이머', () => {
  const expiresAt = T0 + CODE_VALID_MS;

  test('발송 직후 03:00, 마지막 1초 동안 00:01, 만료 순간 00:00', () => {
    assert.equal(formatCountdown(remainingMs(expiresAt, T0)), '03:00');
    assert.equal(formatCountdown(remainingMs(expiresAt, T0 + 1)), '03:00');
    assert.equal(formatCountdown(remainingMs(expiresAt, expiresAt - 999)), '00:01');
    assert.equal(formatCountdown(remainingMs(expiresAt, expiresAt)), '00:00');
  });

  test('00:00이 되면 입력칸을 끈다', () => {
    assert.equal(isInputDisabled(expiresAt, expiresAt - 1), false);
    assert.equal(isInputDisabled(expiresAt, expiresAt), true);
    assert.equal(isInputDisabled(expiresAt, expiresAt + 5_000), true);
  });
});

describe('DTL-AUT-022 발급', () => {
  test('6자리 숫자이고 앞자리 0도 된다', () => {
    assert.equal(generateCode(fixed([0, 1, 2, 3, 4, 5])), '012345');
  });

  test('3분 뒤 만료로 발급한다', () => {
    const issued = issueCode(fixed([1]), T0);
    assert.deepEqual(issued, { code: '111111', expiresAt: T0 + 3 * 60_000, wrongAttempts: 0, used: false });
  });

  test('난수 함수가 0~9 밖을 주면 멈춘다', () => {
    assert.throws(() => generateCode(() => 10), RangeError);
  });
});

describe('DTL-AUT-024·025·047 대조', () => {
  const issued: IssuedCode = { code: '482913', expiresAt: T0 + CODE_VALID_MS, wrongAttempts: 0, used: false };

  test('맞으면 ok이고 그 번호는 사용됨이 된다(1회용)', () => {
    const first = verifyCode(issued, '482913', T0 + 10_000);
    assert.deepEqual(first.result, { status: 'ok' });
    assert.equal(first.state.used, true);
    const again = verifyCode(first.state, '482913', T0 + 20_000);
    assert.deepEqual(again.result, { status: 'used', message: CODE_MESSAGES.resetExpiredOrUsed });
  });

  test('서버는 화면을 믿지 않고 입력을 다시 정리한다', () => {
    assert.equal(verifyCode(issued, ' 482-913 ', T0).result.status, 'ok');
  });

  test('틀리면 남은 시도 횟수를 원문 문구로 알린다', () => {
    const r = verifyCode(issued, '000000', T0);
    assert.deepEqual(r.result, { status: 'wrong', remaining: 4, message: '인증번호가 올바르지 않습니다 (남은 시도 4회)' });
    assert.equal(r.state.wrongAttempts, 1);
  });

  test('5회째 틀리면 무효가 되고, 그 뒤에는 맞는 번호도 받지 않는다', () => {
    let state = issued;
    const statuses: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const r = verifyCode(state, '000000', T0);
      statuses.push(r.result.status);
      state = r.state;
    }
    assert.deepEqual(statuses, ['wrong', 'wrong', 'wrong', 'wrong', 'locked']);
    assert.equal(verifyCode(state, '482913', T0).result.status, 'locked');
  });

  test('만료 시각부터는 맞는 번호도 만료로 본다', () => {
    assert.equal(verifyCode(issued, '482913', issued.expiresAt - 1).result.status, 'ok');
    const r = verifyCode(issued, '482913', issued.expiresAt);
    assert.deepEqual(r.result, { status: 'expired', message: CODE_MESSAGES.expired });
    assert.equal(r.state, issued, '만료된 번호에 대한 시도는 실패 횟수를 늘리지 않는다');
  });

  test('자릿수가 모자란 입력도 한 번의 실패로 센다', () => {
    assert.equal(verifyCode(issued, '4829', T0).state.wrongAttempts, 1);
  });
});

describe('DTL-AUT-026 재발송 1시간 최대 5회', () => {
  test('1시간 안에 5회까지 받고 6회째는 막는다', () => {
    let history: readonly number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const r = tryResend(history, T0 + i * 60_000);
      assert.equal(r.allowed, true);
      if (r.allowed) history = r.history;
    }
    const sixth = tryResend(history, T0 + 5 * 60_000);
    assert.deepEqual(sixth, { allowed: false, retryAt: T0 + RESEND_WINDOW_MS });
  });

  test('가장 오래된 기록이 1시간 밖으로 나가면 다시 된다', () => {
    const history = [0, 1, 2, 3, 4].map((i) => T0 + i * 60_000);
    assert.equal(tryResend(history, T0 + RESEND_WINDOW_MS - 1).allowed, false);
    const r = tryResend(history, T0 + RESEND_WINDOW_MS);
    assert.equal(r.allowed, true);
    if (r.allowed) assert.equal(r.history.length, 5, '1시간 밖 기록은 버린다');
  });
});
